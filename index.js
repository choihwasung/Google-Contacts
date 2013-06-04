/*jslint indent: 2, nomen: true */
/*global console: true, require: true, exports */
var EventEmitter = require('events').EventEmitter;
var GoogleClientLogin = require('googleclientlogin').GoogleClientLogin;
var util = require('util');
var querystring = require('querystring');

var  contactsUrl = '/m8/feeds/contacts/',
  contactGroupsUrl = '/m8/feeds/groups/',
  typeContacts = 'contacts',
  typeGroups = 'groups',
  projectionThin = 'thin';

var GoogleContacts = function (conf) {
  var contacts = this;
  this.conf = conf || {};
  this.conf.service = 'contacts';
};

GoogleContacts.prototype = {};
util.inherits(GoogleContacts, EventEmitter);

GoogleContacts.prototype.auth = function (cb) {
  if (!this.googleAuth) {
    this.googleAuth = new GoogleClientLogin(this.conf);
    this.googleAuth.on('login', function () {
      this.isLoggedIn = true;
    }.bind(this));
  }
  if (!this.isLoggedIn) {
    this.googleAuth.on('login', function () {
      cb();
    }.bind(this));
    this.googleAuth.on('error', function () {
      this.emit('error', 'login failed');
    });
    this.googleAuth.login();
  } else {
    cb();
  }
};
GoogleContacts.prototype.getContacts = function (params) {
  this.auth(function () {
    this._getContacts(params);
  }.bind(this));
};
GoogleContacts.prototype.getContactGroups = function (projection, limit) {
  this.auth(function () {
    this._getContactGroups(projection, limit);
  }.bind(this));
};
GoogleContacts.prototype._onContactsReceived = function (response, data) {
  this.contacts = JSON.parse(data);
  this.emit('contactsReceived', this.contacts);
};
GoogleContacts.prototype._onContactGroupsReceived = function (response, data) {
  this.contactGroups = JSON.parse(data);
  this.emit('contactGroupsReceived', this.contactGroups);
};
GoogleContacts.prototype._onResponse = function (request, response) {
  var data = '', finished = false, onFinish;
  // Thats a hack, because the end event is not emitted, but close yes.
  // https://github.com/joyent/node/issues/728
  onFinish = function () {
    if (!finished) {
      finished = true;
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (request.path.indexOf(contactsUrl) === 0) {
          this._onContactsReceived(response, data);
        } else if (request.path.indexOf(contactGroupsUrl) === 0) {
          this._onContactGroupsReceived(response, data);
        }
      } else {
        var error = new Error('Bad response status: ' + response.statusCode);
        this.emit('error', error);
      }
    }
  }.bind(this);
  response.on('data', function (chunk) {
    data += chunk;
  });

  response.on('error', function (e) {
    this.emit('error', e);
  }.bind(this));

  response.on('close', onFinish);
  response.on('end', onFinish);
};
GoogleContacts.prototype._buildPath = function (type, params) {
  var path, request, projection;
  params = params || {};
  params.alt = 'json';
  projection = projectionThin;

  if (params.projection) {
    projection = params.projection;
    delete params.projection;
  }

  path = type === typeGroups ? contactGroupsUrl : contactsUrl;
  path += this.conf.email + '/' + projection + '?' + querystring.stringify(params);
  return path;
};
GoogleContacts.prototype._get = function (type, params) {
  var request = require('https').request(
    {
      host: 'www.google.com',
      port: 443,
      path: this._buildPath(type, params),
      method: 'GET',
      headers: {
        'Authorization': 'GoogleLogin auth=' + this.googleAuth.getAuthId()
      }
    },
    function (response) {
      this._onResponse(request, response);
    }.bind(this)
  ).on('error', function (e) {
    // console.log('error getting stuff', e);
  });
  request.end();
};
GoogleContacts.prototype._getContacts = function (params) {
  this._get(typeContacts, params);
};
GoogleContacts.prototype._getContactGroups = function (projection, params) {
  this._get(typeGroups, params);
};
exports.GoogleContacts = GoogleContacts;
