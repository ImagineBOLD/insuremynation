package crm

// The CRM contract, offline.
//
// The first three tests are the ones that matter: this API answers 200 when it has thrown the
// lead away, so a client that trusts the status code lets a completely dead integration look
// healthy indefinitely. That has already happened once on this integration.

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func stub(t *testing.T, status int, body string) (*Client, *[]byte) {
	t.Helper()
	var seen []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/webhooks/lead-status" {
			t.Errorf("posted to %q", r.URL.Path)
		}
		if got := r.Header.Get("X-API-Key"); got != "org-key" {
			t.Errorf("X-API-Key %q", got)
		}
		seen, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return &Client{base: srv.URL, key: "org-key", leadTypes: map[string]string{}, hc: srv.Client()}, &seen
}

func aLead() Lead {
	return Lead{
		Phone:  "+919876543210",
		Name:   "Rahul Sharma",
		Email:  "rahul@example.test",
		Line:   "health",
		Status: "qualifying",
		Note:   "InsureNation website chat — health",
		Funnel: map[string]bool{"contact_captured": true, "qualified": true},
		Data:   map[string]string{"page": "/health-insurance"},
		Transcript: &Transcript{
			SessionID: "sess-1",
			Turns:     []Turn{{Role: "user", Text: "hi", At: "2026-09-08T10:00:00Z"}},
		},
	}
}

func TestAMatchedFalseIsAFailure(t *testing.T) {
	// The failure that looks like success. The lead is gone and the CRM said 200.
	c, _ := stub(t, http.StatusOK, `{"matched": false}`)
	res, err := c.Report(context.Background(), aLead())
	if err == nil {
		t.Fatal("matched:false was treated as success")
	}
	if res.OK {
		t.Fatal("result reported OK")
	}
	if !strings.Contains(err.Error(), "NOT MATCHED") {
		t.Fatalf("the error does not name the failure: %v", err)
	}
}

func TestAMatchedTrueWithNoLeadIDIsAlsoAFailure(t *testing.T) {
	// There is nothing to attach the next turn to, so this is not a lead either.
	c, _ := stub(t, http.StatusOK, `{"matched": true, "created": true}`)
	if _, err := c.Report(context.Background(), aLead()); err == nil {
		t.Fatal("a matched:true with no lead_id was treated as success")
	}
}

func TestAMatchedLeadIsSuccess(t *testing.T) {
	c, _ := stub(t, http.StatusOK,
		`{"matched": true, "created": true, "lead_id": "11111111-2222-3333-4444-555555555555"}`)
	res, err := c.Report(context.Background(), aLead())
	if err != nil {
		t.Fatalf("Report: %v", err)
	}
	if !res.OK || res.LeadID == "" || !res.Created {
		t.Fatalf("result %+v", res)
	}
}

func TestNoOrgIDIsEverSent(t *testing.T) {
	// The per-org key IS the tenant. An org_id in the body would mean the caller is using the
	// platform key, which reads and writes every tenant.
	c, seen := stub(t, http.StatusOK, `{"matched":true,"lead_id":"x"}`)
	if _, err := c.Report(context.Background(), aLead()); err != nil {
		t.Fatalf("Report: %v", err)
	}
	var body map[string]any
	if err := json.Unmarshal(*seen, &body); err != nil {
		t.Fatalf("body: %v", err)
	}
	if _, ok := body["org_id"]; ok {
		t.Fatalf("org_id was sent: %s", *seen)
	}
}

func TestNoPhoneSkipsWithoutSpendingARequest(t *testing.T) {
	// The CRM would answer 200/matched:false. Say so here rather than paying to be told.
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	c := &Client{base: srv.URL, key: "org-key", leadTypes: map[string]string{}, hc: srv.Client()}

	lead := aLead()
	lead.Phone = "  "
	if _, err := c.Report(context.Background(), lead); err == nil {
		t.Fatal("a phone-less lead was reported")
	}
	if calls != 0 {
		t.Fatalf("%d requests spent on a lead that cannot resolve", calls)
	}
}

func TestFalseFunnelFlagsAreNeverSent(t *testing.T) {
	// The CRM merges a funnel update rather than replacing it, so a false does not un-set a
	// stage — it is either ignored or, for a stage the org does not know, dropped along with
	// whatever shared the request.
	c, seen := stub(t, http.StatusOK, `{"matched":true,"lead_id":"x"}`)
	lead := aLead()
	lead.Funnel = map[string]bool{"contact_captured": true, "callback_requested": false}
	if _, err := c.Report(context.Background(), lead); err != nil {
		t.Fatalf("Report: %v", err)
	}
	var body struct {
		Funnel map[string]bool `json:"funnel"`
	}
	if err := json.Unmarshal(*seen, &body); err != nil {
		t.Fatalf("body: %v", err)
	}
	if _, ok := body.Funnel["callback_requested"]; ok {
		t.Fatalf("a false flag was sent: %s", *seen)
	}
	if !body.Funnel["contact_captured"] {
		t.Fatalf("a true flag was dropped: %s", *seen)
	}
}

func TestShedDropsDataThenTranscriptAndNeverTheLead(t *testing.T) {
	// Order matters: captured fields first, then the transcript. Identity and the funnel flags
	// are the lead and are never shed.
	big := strings.Repeat("x", 4000)
	lead := aLead()
	lead.Data = map[string]string{}
	for i := 0; i < 20; i++ {
		lead.Data["field"+strings.Repeat("y", i)] = big
	}
	body := payload{
		Phone:  lead.Phone,
		Name:   lead.Name,
		Funnel: lead.Funnel,
		Data:   lead.Data,
		Transcript: &Transcript{SessionID: "sess-1", Turns: []Turn{
			{Role: "user", Text: big}, {Role: "assistant", Text: big},
		}},
	}
	encoded, err := shed(body)
	if err != nil {
		t.Fatalf("shed: %v", err)
	}
	if len(encoded) > maxBody {
		t.Fatalf("shed left %d bytes, cap is %d", len(encoded), maxBody)
	}
	var out map[string]any
	if err := json.Unmarshal(encoded, &out); err != nil {
		t.Fatalf("body: %v", err)
	}
	if _, ok := out["data"]; ok {
		t.Fatal("data was not shed first")
	}
	if out["phone"] == nil || out["funnel"] == nil {
		t.Fatalf("identity or funnel was shed: %s", encoded)
	}
}

func TestSheddingLeavesASmallPayloadWhole(t *testing.T) {
	encoded, err := shed(payload{
		Phone: "+919876543210",
		Data:  map[string]string{"page": "/health-insurance"},
		Transcript: &Transcript{SessionID: "sess-1",
			Turns: []Turn{{Role: "user", Text: "hi"}}},
	})
	if err != nil {
		t.Fatalf("shed: %v", err)
	}
	var out map[string]any
	_ = json.Unmarshal(encoded, &out)
	if out["data"] == nil || out["transcript"] == nil {
		t.Fatalf("a small payload was shed: %s", encoded)
	}
}

func TestAnUnauthorisedReplyNamesTheLikelyCause(t *testing.T) {
	c, _ := stub(t, http.StatusUnauthorized, `{"error":"unauthorized"}`)
	_, err := c.Report(context.Background(), aLead())
	if err == nil {
		t.Fatal("a 401 was treated as success")
	}
	if !strings.Contains(err.Error(), "org key") {
		t.Fatalf("the 401 does not point at the likely cause: %v", err)
	}
}

func TestAnOutageIsAnErrorAndNeverAPanic(t *testing.T) {
	// A reporting failure is logged and swallowed by the caller. It must arrive as an error, not
	// as a panic that would take a goroutine — and with it the process — down.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	c := &Client{base: srv.URL, key: "org-key", leadTypes: map[string]string{}, hc: srv.Client()}
	srv.Close()
	if _, err := c.Report(context.Background(), aLead()); err == nil {
		t.Fatal("an unreachable CRM was treated as success")
	}
}

func TestA200ThatIsNotJSONIsAFailure(t *testing.T) {
	c, _ := stub(t, http.StatusOK, `<html>gateway</html>`)
	if _, err := c.Report(context.Background(), aLead()); err == nil {
		t.Fatal("an HTML 200 was treated as success")
	}
}

func TestALeadTypeIsSentOnlyWhenTheOrgHasOne(t *testing.T) {
	// A key the org does not have is accepted by the API, matches no team member, and leaves
	// the lead queued forever with nothing reporting an error.
	c, seen := stub(t, http.StatusOK, `{"matched":true,"lead_id":"x"}`)
	if _, err := c.Report(context.Background(), aLead()); err != nil {
		t.Fatalf("Report: %v", err)
	}
	if strings.Contains(string(*seen), "lead_type") {
		t.Fatalf("lead_type sent with no mapping configured: %s", *seen)
	}

	c2, seen2 := stub(t, http.StatusOK, `{"matched":true,"lead_id":"x"}`)
	c2.leadTypes = map[string]string{"health": "health_insurance"}
	if _, err := c2.Report(context.Background(), aLead()); err != nil {
		t.Fatalf("Report: %v", err)
	}
	if !strings.Contains(string(*seen2), `"lead_type":"health_insurance"`) {
		t.Fatalf("a configured lead_type was not sent: %s", *seen2)
	}
}

func TestNoKeyDisablesReporting(t *testing.T) {
	c := &Client{}
	if c.Enabled() {
		t.Fatal("a keyless client reports itself enabled")
	}
	if _, err := c.Report(context.Background(), aLead()); err == nil {
		t.Fatal("a keyless client reported a lead")
	}
}

func TestConsentTravelsAsItsOwnBlock(t *testing.T) {
	// Not a `data` field. A custom field is a note about the lead; consent is the lawful basis
	// for messaging them, and only the top-level block is visible to the CRM's send gate.
	c, seen := stub(t, http.StatusOK, `{"matched":true,"lead_id":"x"}`)
	lead := aLead()
	lead.Consent = &Consent{
		Status:      "granted",
		ConsentText: "May we send you the plan details and updates on WhatsApp on this number?",
		OptionTitle: "Yes, message me",
		PageURL:     "/health-insurance",
	}
	if _, err := c.Report(context.Background(), lead); err != nil {
		t.Fatalf("Report: %v", err)
	}
	var body struct {
		Consent *Consent `json:"consent"`
	}
	if err := json.Unmarshal(*seen, &body); err != nil {
		t.Fatalf("body: %v", err)
	}
	if body.Consent == nil {
		t.Fatalf("no consent block sent: %s", *seen)
	}
	if body.Consent.Channel != "whatsapp" {
		t.Fatalf("channel %q, want whatsapp", body.Consent.Channel)
	}
	// The load-bearing field: "they agreed" is not a record, the question they saw is.
	if !strings.Contains(body.Consent.ConsentText, "WhatsApp on this number") {
		t.Fatalf("consent_text lost: %+v", body.Consent)
	}
}

func TestARefusalIsRecordedRatherThanOmitted(t *testing.T) {
	// "no record" and "they said no" are different facts.
	c, seen := stub(t, http.StatusOK, `{"matched":true,"lead_id":"x"}`)
	lead := aLead()
	lead.Consent = &Consent{Status: "denied", ConsentText: "May we send you..."}
	if _, err := c.Report(context.Background(), lead); err != nil {
		t.Fatalf("Report: %v", err)
	}
	if !strings.Contains(string(*seen), `"status":"denied"`) {
		t.Fatalf("a refusal was not recorded: %s", *seen)
	}
}

func TestAnUnusableConsentStatusIsDroppedNotSent(t *testing.T) {
	// The CRM 400s the whole request on a status outside its vocabulary, which would take the
	// funnel update down with it. Dropping the block loses one record; sending it loses the lead.
	c, seen := stub(t, http.StatusOK, `{"matched":true,"lead_id":"x"}`)
	lead := aLead()
	lead.Consent = &Consent{Status: "maybe"}
	if _, err := c.Report(context.Background(), lead); err != nil {
		t.Fatalf("Report: %v", err)
	}
	if strings.Contains(string(*seen), "consent") {
		t.Fatalf("an unusable consent status was sent: %s", *seen)
	}
	if !strings.Contains(string(*seen), "funnel") {
		t.Fatalf("the funnel update was lost with it: %s", *seen)
	}
}

func TestConsentIsNeverShed(t *testing.T) {
	// Identity, funnel and consent are the lead. Only data and the transcript are expendable.
	big := strings.Repeat("x", 4000)
	data := map[string]string{}
	for i := 0; i < 20; i++ {
		data["field"+strings.Repeat("y", i)] = big
	}
	encoded, err := shed(payload{
		Phone:   "+919876543210",
		Funnel:  map[string]bool{"contact_captured": true},
		Consent: &Consent{Channel: "whatsapp", Status: "granted", ConsentText: "May we..."},
		Data:    data,
		Transcript: &Transcript{SessionID: "s", Turns: []Turn{
			{Role: "user", Text: big}, {Role: "assistant", Text: big},
		}},
	})
	if err != nil {
		t.Fatalf("shed: %v", err)
	}
	if len(encoded) > maxBody {
		t.Fatalf("shed left %d bytes", len(encoded))
	}
	if !strings.Contains(string(encoded), `"consent"`) {
		t.Fatalf("consent was shed: %s", encoded)
	}
}
