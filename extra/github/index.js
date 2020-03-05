// -*- mode: js; js-indent-level:2;  -*-
// Copyright 2020-present Philippe Coval <http://purl.org/rzr/>
// SPDX-Licence: Apache-2.0

const core = require('@actions/core');
const github = require('@actions/github');
const mastodon = require('mastodon-lite');

try {
  var app = {};
  app.config = {
    access_token: '[TODO: Update with app token at https://mastodon.social/settings/applications]',
    host: 'mastodon.social',
    port: 443,
    api: '/api/v1',
    rejectUnauthorized: false
  };
  if (process.env.MASTODON_ACCESS_TOKEN) {
    app.config.access_token = process.env.MASTODON_ACCESS_TOKEN;
  }
  app.mastodon = new Mastodon(app.config);
  const message = core.getInput('status');
  app.mastodon.post(message, (err, status) => {
    if (err) {
      core.setFailed(err);
    }
    console.log(status);
  });
} catch (error) {
  core.setFailed(error.message);
}