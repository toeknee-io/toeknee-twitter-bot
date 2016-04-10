var EventEmitter, Twitter, TwitterBot, _, consts, filteredStream, fs, getUser, path, rp,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

EventEmitter = require('events');

rp = require('request-promise');

Twitter = require('twitter');

path = require('path');

_ = require('lodash');

fs = require('fs');

consts = require('js-yaml').safeLoad(fs.readFileSync(path.resolve(__dirname, '../config/constants.yaml'), 'utf8'));

filteredStream = consts.TWITTER_STREAM_FILTER_ENDPOINT;

getUser = consts.TWITTER_GET_USER_ENDPOINT;

TwitterBot = (function(superClass) {
  extend(TwitterBot, superClass);

  function TwitterBot(__config) {
    var client, config;
    this.__config = __config;
    this._testConn = bind(this._testConn, this);
    config = this.__config;
    if (!config || !config.auth) {
      throw new Error('Config object with auth properties must be provided on instantiation');
    } else {
      client = new Twitter(config.auth);
    }
    this.stream = {};
    this.stream.keyword = (function(_this) {
      return function(opts) {
        if (!opts.track) {
          return _this.emit('error', new Error('Streaming by keyword requires options to have a track property'));
        }
        return client.stream(filteredStream, opts, function(stream) {
          stream.on('data', function(tweet) {
            return _this.emit('keyword-tweet', _this._formatTweet(tweet));
          });
          return stream.on('error', function(err) {
            return _this.emit('error', err);
          });
        });
      };
    })(this);
    this.stream.user = (function(_this) {
      return function(opts) {
        if (!opts.screen_name) {
          return _this.emit('error', new Error('Streaming by user id requires options to have a screen_name property'));
        }
        return client.get(getUser, opts, function(errors, users, res) {
          var user;
          if (errors) {
            return _this.emit('error', errors);
          }
          user = _.find(users, function(u) {
            return u.screen_name === opts.screen_name;
          });
          return client.stream(filteredStream, {
            follow: user.id_str
          }, function(stream) {
            stream.on('data', function(tweet) {
              return _this.emit('user-tweet', tweet);
            });
            return stream.on('error', function(err) {
              return _this.emit('error', err);
            });
          });
        });
      };
    })(this);
    this._testConn(client);
  }

  TwitterBot.prototype.tweet = function(opts) {};

  TwitterBot.prototype.tweetAt = function(opts) {};

  TwitterBot.prototype.scheduleTweet = function(opts) {};

  TwitterBot.prototype.callApi = function(opts) {
    return rp(opts.uri).then(function(data) {});
  };

  TwitterBot.prototype._testConn = function(client) {
    return client.get('favorites/list', (function(_this) {
      return function(errors, tweets, res) {
        if (errors) {
          errors.forEach(function(err) {
            if (err.code === consts.TWITTER_AUTH_ERROR_CODE || ~err.message.indexOf(consts.TWITTER_AUTH_ERROR_MSG)) {
              return _this.emit('error', new Error("Failed to authenticate with Twitter"));
            } else {
              return _this.emit('error', errors);
            }
          });
        }
        return _this.emit('connection', true);
      };
    })(this));
  };

  TwitterBot.prototype._formatTweet = function(tweet) {
    var tweetObj;
    tweetObj = {
      id: tweet.id,
      timestamp: tweet.timestamp_ms,
      msg: tweet.text,
      tweeted_by: tweet.user.screen_name,
      replied_to: {
        user: tweet.in_reply_to_screen_name,
        status: tweet.in_reply_to_status_id
      }
    };
    if (!tweetObj.replied_to.user) {
      delete tweetObj.replied_to;
    }
    if (tweet.entities.length) {
      tweetObj.hashtags = tweet.entities.hashtags.map(function(obj) {
        return obj.text;
      });
    }
    return tweetObj;
  };

  return TwitterBot;

})(EventEmitter);

module.exports = TwitterBot;
