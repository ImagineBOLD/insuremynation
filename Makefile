# Deploys the repo to Railway. The Docker build does everything itself
# (npm build + go embed), so there is nothing to build locally first.
# NB: the CLI sometimes times out on its status call after the upload has
# already started — check `railway deployment list` before re-running.
.PHONY: deploy
deploy:
	railway up --service insuremynation --ci
