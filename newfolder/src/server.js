/**
 * Server to Intercept the client's requests and handle them on their behalf.
 * Initiates stats and connectivity checks when a requests fails.
 * It also responds in selenium understandable error when a request fails
 * at tool.
 */

var http = require('http');
var url = require('url');
var Utils = require('./utils');
var constants = require('../config/constants');
var ReqLib = require('./requestLib');
var NwtGlobalConfig = constants.NwtGlobalConfig;

var NWTHandler = {

  _requestCounter: 0,

  /**
   * Generates the request options template for firing requests based on
   * whether the user had provided any proxy input or not.
   */
  generatorForRequestOptionsObject: function () {
    NWTHandler._reqObjTemplate = {
      method: null,
      headers: {},
      host: null,
      port: null,
      path: null
    };

    if (NwtGlobalConfig.proxy) {
      NWTHandler._reqObjTemplate.host = NwtGlobalConfig.proxy.host;
      NWTHandler._reqObjTemplate.port = NwtGlobalConfig.proxy.port;
      
      if (NwtGlobalConfig.proxy.username && NwtGlobalConfig.proxy.password) {
        NWTHandler._reqObjTemplate.headers['Proxy-Authorization'] = Utils.proxyAuthToBase64(NwtGlobalConfig.proxy);
      }

      NWTHandler._generateRequestOptions = function (clientRequest) {
        var parsedClientUrl = url.parse(clientRequest.url);
        var headersCopy = Object.assign({}, clientRequest.headers, NWTHandler._reqObjTemplate.headers);
        var requestOptions = Object.assign({}, NWTHandler._reqObjTemplate);
        requestOptions.path = parsedClientUrl.href;
        requestOptions.method = clientRequest.method;
        requestOptions.headers = headersCopy;
        return requestOptions;
      };
    } else {
      NWTHandler._generateRequestOptions = function (clientRequest) {
        var parsedClientUrl = url.parse(clientRequest.url);
        var requestOptions = Object.assign({}, NWTHandler._reqObjTemplate);
        requestOptions.host = parsedClientUrl.hostname;
        requestOptions.port = parsedClientUrl.port || 80;
        requestOptions.path = parsedClientUrl.path;
        requestOptions.method = clientRequest.method;
        requestOptions.headers = clientRequest.headers;
        if (parsedClientUrl.auth) {
          requestOptions.headers['authorization'] = Utils.proxyAuthToBase64(parsedClientUrl.auth);
        }
        return requestOptions;
      };
    }
  },

  /**
   * Frames the error response based on the type of request.
   * i.e., if its a request originating for Hub, the response
   * is in the format which the client binding would understand.
   * @param {Object} parsedRequest 
   * @param {String} errorMessage 
   */
  _frameErrorResponse: function (parsedRequest, errorMessage) {
    errorMessage += '. ' + constants.REQ_FAILED_MSG;
    var parseSessionId = parsedRequest.path.match(/\/wd\/hub\/session\/([a-z0-9]+)\/*/);
    if (parseSessionId) {
      var sessionId = parseSessionId[1];
      return {
        data: {
          sessionId: sessionId,
          status: 13,
          value: {
            message: errorMessage,
            error: constants.REQ_FAILED_MSG
          },
          state: 'error'
        },
        statusCode: 500
      };
    } else {
      return {
        data: {
          message: errorMessage,
          error: constants.REQ_FAILED_MSG
        },
        statusCode: 500
      };
    }
  },

  /**
   * Handler for incoming requests to Network Utility Tool proxy server.
   * @param {} clientRequest 
   * @param {} clientResponse 
   */
  requestHandler: function (clientRequest, clientResponse) {
    clientRequest.id = ++NWTHandler._requestCounter;

    var request = {
      method: clientRequest.method,
      url: clientRequest.url,
      headers: clientRequest.headers,
      data: []
    };
    
    NwtGlobalConfig.ReqLogger.info("Request Start", request.method + ' ' + request.url,
      false, { 
        headers: request.headers 
      }, 
      clientRequest.id);

    var furtherRequestOptions = NWTHandler._generateRequestOptions(clientRequest);

    var paramsForRequest = {
      request: request,
      furtherRequestOptions: furtherRequestOptions
    };

    ReqLib.call(paramsForRequest, clientRequest)
      .then(function (response) {
        NwtGlobalConfig.ReqLogger.info("Response End", clientRequest.method + ' ' + clientRequest.url + ', Status Code: ' + response.statusCode,
          false, {
            data: response.data,
            headers: response.headers,
          },
          clientRequest.id);

        clientResponse.writeHead(response.statusCode, response.headers);
        clientResponse.end(response.data);
      })
      .catch(function (err) {
        NwtGlobalConfig.ReqLogger.error(err.customTopic, clientRequest.method + ' ' + clientRequest.url,
          false, {
            errorMessage: err.message.toString()
          },
          clientRequest.id);

        var errorResponse = NWTHandler._frameErrorResponse(furtherRequestOptions, err.message.toString());
        NwtGlobalConfig.ReqLogger.error("Response End", clientRequest.method + ' ' + clientRequest.url + ', Status Code: ' + errorResponse.statusCode,
          false,
          errorResponse.data,
          clientRequest.id);

        clientResponse.writeHead(errorResponse.statusCode);
        clientResponse.end(JSON.stringify(errorResponse.data));
      });
  },

  /**
   * Starts the proxy server on the given port
   * @param {String|Number} port 
   * @param {Function} callback 
   */
  startProxy: function (port, callback) {
    try {
      NWTHandler.generatorForRequestOptionsObject();
      NWTHandler.server = http.createServer(NWTHandler.requestHandler);
      NWTHandler.server.listen(port);
      NWTHandler.server.on('listening', function () {
        callback(null, port);
      });
      NWTHandler.server.on('error', function (err) {
        callback(err.toString(), null);
      });
    } catch (e) {
      callback(e.toString(), null);
    }
  },

  /**
   * Stops the currently running proxy server
   * @param {Function} callback 
   */
  stopProxy: function (callback) {
    try {
      if (NWTHandler.server) {
        NWTHandler.server.close();
        NWTHandler.server = null;
      }
      callback(null, true);
    } catch (e) {
      callback(e.toString(), null);
    }
  }
};

module.exports = NWTHandler;
