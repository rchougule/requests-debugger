var url = require('url');
var ConnectivityChecker = require('../src/connectivity');
var constants = require('../config/constants');
var NwtGlobalConfig = constants.NwtGlobalConfig;
var Utils = require('../src/utils');
var nock = require('nock');
var sinon = require('sinon');

function nockGetRequest(reqUrl, type, data, statusCode) {
  data = (data && typeof data === 'object') ? data : { "data": "value" };
  type = (['http', 'https'].indexOf(type) !== -1) ? type : 'http';
  try {
    statusCode = parseInt(statusCode);
  } catch (e) {
    statusCode = 200;
  }

  var parsedUrl = url.parse(reqUrl);
  var port = parsedUrl.port;
  port = port || (type === 'http' ? '80' : '443');
  return nock(type + '://' + parsedUrl.hostname + ':' + port)
    .get(parsedUrl.path)
    .reply(statusCode, data);
}

function nockProxyUrl(proxyObj, type, component, data, statusCode) {
  type = ['http', 'https'].indexOf(type) ? type : 'http';
  data = (data && typeof data === 'object') ? data : { "data": "value" };
  try {
    statusCode = parseInt(statusCode);
  } catch (e) {
    statusCode = 200;
  }

  var proxyUrl = type + '://' + proxyObj.host + ':' + proxyObj.port;
  return nock(proxyUrl)
    .get(new RegExp(component))
    .reply(statusCode, data);
}

function nockGetRequestWithError(reqUrl, type) {
  type = (['http', 'https'].indexOf(type) !== -1) ? type : 'http';

  var parsedUrl = url.parse(reqUrl);
  var port = parsedUrl.port;
  port = port || (type === 'http' ? '80' : '443');
  return nock(type + '://' + parsedUrl.hostname + ':' + port)
    .get(parsedUrl.path)
    .replyWithError('something terrible');
}

describe('Connectivity Checker for BrowserStack Components', function () {
  context('without Proxy', function () {
    beforeEach(function () {
      NwtGlobalConfig.deleteProxy();
      NwtGlobalConfig.initializeDummyLoggers();
      ConnectivityChecker.connectionChecks = [];
      nockGetRequest(constants.HUB_STATUS_URL, 'http', null, 200);
      nockGetRequest(constants.HUB_STATUS_URL, 'https', null, 200);
      nockGetRequest(constants.RAILS_AUTOMATE, 'http', null, 301);
      nockGetRequest(constants.RAILS_AUTOMATE, 'https', null, 302);
    });

    afterEach(function () {
      nock.cleanAll();
      NwtGlobalConfig.deleteLoggers();
    });

    it('HTTP(S) to Hub & Rails', function (done) {
      this.timeout(2000);
      sinon.stub(Utils, 'beautifyObject');

      var result = [{
          data: '{"data":"value"}',
          statusCode: 200,
          errorMessage: null,
          description: 'HTTP Request To Hub Without Proxy',
          result: 'Passed'
        }, {
          data: '{"data":"value"}',
          statusCode: 301,
          errorMessage: null,
          description: 'HTTP Request To Rails Without Proxy',
          result: 'Passed'
        }, {
          data: '{"data":"value"}',
          statusCode: 200,
          errorMessage: null,
          description: 'HTTPS Request To Hub Without Proxy',
          result: 'Passed'
        }, {
          data: '{"data":"value"}',
          statusCode: 302,
          errorMessage: null,
          description: 'HTTPS Request to Rails Without Proxy',
          result: 'Passed'
        }
      ];

      ConnectivityChecker.fireChecks("some topic", 1, function () {
        sinon.assert.calledOnceWithExactly(Utils.beautifyObject, result, "Result Key", "Result Value");
        Utils.beautifyObject.restore();
        done();
      });
    });
  });

  context('with Proxy', function () {
    beforeEach(function () {
      NwtGlobalConfig.initializeDummyProxy();
      NwtGlobalConfig.initializeDummyLoggers();
      ConnectivityChecker.connectionChecks = [];
      nockGetRequest(constants.HUB_STATUS_URL, 'http', null, 200);
      nockGetRequest(constants.HUB_STATUS_URL, 'https', null, 200);
      nockGetRequest(constants.RAILS_AUTOMATE, 'http', null, 301);
      nockGetRequest(constants.RAILS_AUTOMATE, 'https', null, 302);
      nockProxyUrl(NwtGlobalConfig.proxy, 'http', 'hub', null, 200);
      nockProxyUrl(NwtGlobalConfig.proxy, 'http', 'automate', null, 301);
    });

    afterEach(function () {
      nock.cleanAll();
      NwtGlobalConfig.deleteLoggers();
      NwtGlobalConfig.deleteProxy();
    });

    it('HTTP(S) to Hub & Rails', function (done) {
      this.timeout(2000);
      sinon.stub(Utils, 'beautifyObject');

      var result = [{
          data: '{"data":"value"}',
          statusCode: 200,
          errorMessage: null,
          description: 'HTTP Request To Hub Without Proxy',
          result: 'Passed'
        }, {
          data: '{"data":"value"}',
          statusCode: 301,
          errorMessage: null,
          description: 'HTTP Request To Rails Without Proxy',
          result: 'Passed'
        }, {
          data: '{"data":"value"}',
          statusCode: 200,
          errorMessage: null,
          description: 'HTTPS Request To Hub Without Proxy',
          result: 'Passed'
        }, {
          data: '{"data":"value"}',
          statusCode: 302,
          errorMessage: null,
          description: 'HTTPS Request to Rails Without Proxy',
          result: 'Passed'
        }, {
          data: '{"data":"value"}',
          description: "HTTP Request To Hub With Proxy",
          errorMessage: null,
          result: "Passed",
          statusCode: 200
        }, {
          data: '{"data":"value"}',
          description: "HTTP Request To Rails With Proxy",
          errorMessage: null,
          result: "Passed",
          statusCode: 301
        }
      ];

      ConnectivityChecker.fireChecks("some topic", 1, function () {
        sinon.assert.calledOnceWithExactly(Utils.beautifyObject, result, "Result Key", "Result Value");
        Utils.beautifyObject.restore();
        done();
      });
    });
  });

  // similar case as non error scenario. The only difference is to trigger the 'error' event of request
  // Thus, no need to show it for 'with proxy' case
  context('without Proxy error case', function () {
    beforeEach(function () {
      NwtGlobalConfig.deleteProxy();
      NwtGlobalConfig.initializeDummyLoggers();
      ConnectivityChecker.connectionChecks = [];
      nockGetRequestWithError(constants.HUB_STATUS_URL, 'http');
      nockGetRequestWithError(constants.HUB_STATUS_URL, 'https');
      nockGetRequestWithError(constants.RAILS_AUTOMATE, 'http');
      nockGetRequestWithError(constants.RAILS_AUTOMATE, 'https');
    });

    afterEach(function () {
      nock.cleanAll();
      NwtGlobalConfig.deleteLoggers();
    });

    it('HTTP(S) to Hub & Rails', function (done) {
      this.timeout(2000);
      sinon.stub(Utils, 'beautifyObject');

      var result = [{
          data: [],
          statusCode: null,
          errorMessage: 'Error: something terrible',
          description: 'HTTP Request To Hub Without Proxy',
          result: 'Failed'
        }, {
          data: [],
          statusCode: null,
          errorMessage: 'Error: something terrible',
          description: 'HTTP Request To Rails Without Proxy',
          result: 'Failed'
        }, {
          data: [],
          statusCode: null,
          errorMessage: 'Error: something terrible',
          description: 'HTTPS Request To Hub Without Proxy',
          result: 'Failed'
        }, {
          data: [],
          statusCode: null,
          errorMessage: 'Error: something terrible',
          description: 'HTTPS Request to Rails Without Proxy',
          result: 'Failed'
        }
      ];

      ConnectivityChecker.fireChecks("some topic", 1, function () {
        sinon.assert.calledOnceWithExactly(Utils.beautifyObject, result, "Result Key", "Result Value");
        Utils.beautifyObject.restore();
        done();
      });
    });
  });
});
