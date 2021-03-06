/* -*- mode: js; js-indent-level:2;  -*-
   SPDX-License-Identifier: MPL-2.0 */
/**
 * Activitypub-adapter.js - ActivityPub adapter.
 *
 * Copyright 2018-present Samsung Electronics Co., Ltd. and other contributors
 */

const Mastodon = require('mastodon-lite');
const htmlToText = require('html-to-text');
const manifest = require('./manifest.json');

const {
  Adapter,
  Database,
  Device,
  Property
} = require('gateway-addon');

function message() {
  return {
    name: 'message',
    metadata: {
      label: "Message",
      type: 'string'
    }
  };
}

const mastodonActuator = {
  type: 'stringActuator',
  actuatorType: 'stringActuator',
  name: 'ActivityPubActuator',
  properties: [message()]
};


const ACTIVITYPUB_THINGS = [mastodonActuator];


class ActivityPubProperty extends Property {
  constructor(device, name, desc, value) {
    super(device, name, desc);
    const that = this;
    this.setCachedValue(value);
    this.device.notifyPropertyChanged(this);

    this.frequency = 1 / 60;
    this.inteval = setInterval(() => {
      that.device.adapter.mastodon.get(
        null,
        (err, data) => {
          if (err || !data || !data[0]) {
            throw err;
          }
          const latest = data && data[0] && data[0].content &&
              htmlToText.fromString(
                data[0].content,
                {noLinkBrackets: true,
                 ignoreImage: true,
                 ignoreHref: true}
              );
          that.setCachedValue(latest);
          that.device.notifyPropertyChanged(that);
        }
      );
    }, 1000 / this.frequency);
  }

  setValue(value) {
    const that = this;
    const changed = this.value !== value;

    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        resolve(updatedValue);
        if (changed) {
          that.device.adapter.mastodon.post(updatedValue, (err, data) => {
            if (err || !data) {
              throw err;
            }
          });
          that.device.notifyPropertyChanged(this);
        }
      }).
        catch((err) => {
          reject(err);
        });
    });
  }
}

class ActivityPubDevice extends Device {
  constructor(adapter, id, config) {
    super(adapter, id);
    this.config = config;
    this.type = config.type;
    this.name = config.name;
    this.description = 'ActivityPub Actuator';
    this.actuatorType = config.actuatorType;
    this.links = [
      {
        rel: 'alternate',
        mediaType: 'text/html',
        href: adapter.mastodon.getUrl()
      }
    ];
    for (const prop of config.properties) {
      this.properties.set(prop.name, new ActivityPubProperty(
        this, prop.name, prop.metadata,
        adapter.mastodon.message
      ));
    }

    this.adapter.handleDeviceAdded(this);
  }
}

class ActivityPubAdapter extends Adapter {
  constructor(addonManager) {
    super(addonManager, manifest.id, manifest.id);
    addonManager.addAdapter(this);

    const db = new Database(this.packageName);
    db.open().then(() => {
      return db.loadConfig();
    }).then((config) => {
      let devices;
      if (config.hasOwnProperty('activitypub') &&
          config.activitypub.length > 0) {
        devices = config.activitypub;
      } else {
        devices = ACTIVITYPUB_THINGS;
      }

      this.config = {};
      this.config.access_token = config.access_token;
      this.config.hostname = config.hostname || 'mastodon.social';
      this.config.port = Number(config.port || 443);
      this.config.api = config.api || '/api/v1';
      this.config.rejectUnauthorized = Boolean(config.rejectUnauthorized);
      this.mastodon = Mastodon(this.config);

      for (let idx = 0; idx < devices.length; idx += 1) {
        const id = `activitypub-${idx}`;
        new ActivityPubDevice(this, id, devices[idx]);
      }
    }).catch(console.error);
  }
}

function loadActivityPubAdapter(addonManager, errorCallback) {
  try {
    new ActivityPubAdapter(addonManager);
  } catch (err) {
    errorCallback(manifest.id, `error: Failed to construct${err}`);
  }
}

module.exports = loadActivityPubAdapter;
