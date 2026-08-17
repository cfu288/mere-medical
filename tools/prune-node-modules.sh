#!/bin/sh
# Replicates tj/node-prune's default rules, replacing the remote binary previously fetched via gobinaries.com
set -eu

find node_modules -type d \( \
  -name __tests__ -o -name test -o -name tests -o -name powered-test \
  -o -name docs -o -name doc -o -name .idea -o -name .vscode \
  -o -name website -o -name images -o -name assets -o -name example \
  -o -name examples -o -name coverage -o -name .nyc_output \
  -o -name .circleci -o -name .github \) -prune -print0 | xargs -0 rm -rf

find node_modules -type f \( \
  -name Jenkinsfile -o -name Makefile -o -name Gulpfile.js -o -name Gruntfile.js \
  -o -name gulpfile.js -o -name .DS_Store -o -name .tern-project -o -name .gitattributes \
  -o -name .editorconfig -o -name .eslintrc -o -name eslint -o -name .eslintrc.js \
  -o -name .eslintrc.json -o -name .eslintrc.yml -o -name .eslintignore -o -name .stylelintrc \
  -o -name stylelint.config.js -o -name .stylelintrc.json -o -name .stylelintrc.yaml \
  -o -name .stylelintrc.yml -o -name .stylelintrc.js -o -name .htmllintrc -o -name htmllint.js \
  -o -name .lint -o -name .npmrc -o -name .npmignore -o -name .jshintrc -o -name .flowconfig \
  -o -name .documentup.json -o -name .yarn-metadata.json -o -name .travis.yml \
  -o -name appveyor.yml -o -name .gitlab-ci.yml -o -name circle.yml -o -name .coveralls.yml \
  -o -name CHANGES -o -name changelog -o -name LICENSE.txt -o -name LICENSE \
  -o -name LICENSE-MIT -o -name LICENSE.BSD -o -name license -o -name LICENCE.txt \
  -o -name LICENCE -o -name LICENCE-MIT -o -name LICENCE.BSD -o -name licence \
  -o -name AUTHORS -o -name CONTRIBUTORS -o -name .yarn-integrity -o -name .yarnclean \
  -o -name _config.yml -o -name .babelrc -o -name .yo-rc.json -o -name jest.config.js \
  -o -name karma.conf.js -o -name wallaby.js -o -name wallaby.conf.js -o -name .prettierrc \
  -o -name .prettierrc.yml -o -name .prettierrc.toml -o -name .prettierrc.js \
  -o -name .prettierrc.json -o -name prettier.config.js -o -name .appveyor.yml \
  -o -name tsconfig.json -o -name tslint.json \
  -o -name '*.markdown' -o -name '*.md' -o -name '*.mkd' -o -name '*.ts' \
  -o -name '*.jst' -o -name '*.coffee' -o -name '*.tgz' -o -name '*.swp' \) -delete
