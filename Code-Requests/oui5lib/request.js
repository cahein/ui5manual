/** @namespace oui5lib.request */
(function () {

    /**
     * Send XMLHttpRequest expecting JSON.
     * @memberof oui5lib.request
     * @param {string} url The URL of the json to load.
     * @param {function} handleSuccess The function to call if the request
     * is successfully completed. 
     * @param {object} requestProps Properties to be passed with the request.
     * @param {boolean} isAsync Load asynchronously? Defaults to 'true'.
     * @param {string} httpVerb GET or POST.
     * @param {string} encodedParams The url-encoded parameters string.
     */
    function fetchJson(url, handleSuccess, requestProps, isAsync,
                       httpVerb, encodedParams) {
        if (typeof isAsync !== "boolean") {
            isAsync = true;
        }
        if (typeof httpVerb === "undefined") {
            httpVerb = "GET";
        }
        if (typeof encodedParams !== "undefined" && httpVerb === "GET") {
            var protocolRegex = /^https?.*/;
            if (protocolRegex.test(url)) {
                url += "?" + encodedParams;
            }
        }

        var xhr = new XMLHttpRequest();
        xhr.overrideMimeType("application/json");
        xhr.open(httpVerb, url, isAsync);
        
        addHandlers(xhr, handleSuccess, requestProps, isAsync);        

        if (httpVerb === "POST") {
            xhr.send(encodedParams);
        } else {
            xhr.send();
        }
    }

    
    /**
     * Run XMLHttpRequest defined in the mapping.
     * @memberof oui5lib.request
     * @param {string} entityName The name of the entity.
     * @param {string} requestName The name of the request.
     * @param {object} data The data provided for the request.
     * @param {function} handleSuccess The function to call if the request
     * is successfully completed.
     * @param {boolean} isAsync Load asynchronously? Defaults to 'true'.
     */
    function sendMappingRequest(entityName, requestName,
                                data, handleSuccess, isAsync) {
        if (typeof oui5lib.mapping !== "object") {
            throw new Error("oui5lib.mapping namespace not loaded");
        }
        
        if (data === undefined || data === null) {
            data = {};
        }
        if (typeof isAsync !== "boolean") {
            if (oui5lib.configuration.getEnvironment() === "testing") {
                isAsync = false;
            } else {
                isAsync = true;
            }
        }
        
        var requestConfig = oui5lib.mapping.getRequestConfiguration(entityName,
                                                                    requestName);
        
        var requestParams = procParameters(data, requestConfig);
        var encodedParams = getEncodedParams(requestParams);
        oui5lib.logger.info("request parameter string: " + encodedParams);

        var httpVerb = requestConfig.method;
        var url = procUrl(requestConfig);
        oui5lib.logger.info("request url: " + url);

        fetchJson(url, handleSuccess, { "entity": entityName,
                                        "request": requestName
                                      }, isAsync, httpVerb, encodedParams);
    }
    
    function addHandlers(xhr, handleSuccess, requestProps, isAsync) {
        xhr.onload = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 0) {
                    var responseData = null;
                    try {
                        responseData = JSON.parse(xhr.responseText);
                    } catch(e) {
                        throw new Error("JSON is invalid");
                    }
                    if (typeof handleSuccess === "function") {
                        handleSuccess(responseData, requestProps);
                    }
                } else {
                    oui5lib.event.publishRequestFailureEvent("status",
                                                             xhr, requestProps);
                }
            }
        };
        
        xhr.onerror = function() {
            oui5lib.event.publishRequestFailureEvent("error",
                                                     xhr, requestProps);
        };

        if (isAsync) {
            xhr.timeout = 500;
            xhr.ontimeout = function() {
                oui5lib.event.publishRequestFailureEvent("timeout",
                                                         xhr, requestProps);
            };
        }
        return xhr;
    }

    /**
     * Process the URL. Depends upon the environment. For the production environment the URL is generated from the mapping.
     * @memberof oui5lib.request
     * @inner 
     * @param {object} requestConfig
     * @returns {string} The request url.
     */
    function procUrl(requestConfig) {
        var pathname = requestConfig.pathname;

        switch (oui5lib.configuration.getEnvironment()) {
        case "development":
            if (typeof oui5lib.request.getDevelopmentUrl === "function") {
                return oui5lib.request.getDevelopmentUrl(pathname);
            }
            break;
        case "testing":
            if (typeof oui5lib.request.getTestingUrl === "function") {
                return oui5lib.request.getTestingUrl(pathname);
            }
            break;
        case "staging":
            if (typeof oui5lib.request.getStagingUrl === "function") {
                return oui5lib.request.getStagingUrl(pathname);
            }
            break;
        }
        var protocol = requestConfig.protocol;
        var host = requestConfig.host;
        var requestUrl = protocol + "://" + host + "/" + pathname;
        return requestUrl;
    }
    
    /**
     * Process parameters
     * @memberof oui5lib.request
     * @inner 
     * @param {object} params
     * @param {object} requestConfig
     */
    function procParameters(data, requestConfig) {
        var paramsConfig = requestConfig.parameters;
        if (paramsConfig === undefined || paramsConfig.length === 0) {
            return {};
        }
        
        var requestParams = {};
        var paramName, paramValue;
        paramsConfig.forEach(function(paramConf) {
            paramName = paramConf.name;
            paramValue = null;
            if (data[paramName] === undefined) {
                if (typeof paramConf.default === "string") {
                    paramValue = paramConf.default;
                }
            } else {
                paramValue = data[paramName];
                if (paramConf.type !== "string") {
                    paramValue = convertToString(paramValue, paramConf);
                }
            }

            if (paramConf.required && paramValue === null) {
               throw new Error("required parameter missing: " + paramName);
            }
            if (paramValue !== null) {
                requestParams[paramName] = paramValue;
            }
        });
        return requestParams;
    }
    
    /**
     * Convert value according to parameter definition.
     * @memberof oui5lib.request
     * @inner 
     * @param {boolean|number|Date|Array} value
     * @param {object} paramConfig
     */
    function convertToString(value, paramConf) {
        var type = paramConf.type;
        switch (type) {
        case "Date":
            if (value instanceof Date &&
                typeof paramConf.dateFormat === "string") {
                value = oui5lib.formatter.getDateString(value,
                                                        paramConf.dateFormat);
            }
            break;
        case "Time":
            if (value instanceof Date &&
                typeof paramConf.timeFormat === "string") {
                value = oui5lib.formatter.getTimeString(value,
                                                        paramConf.timeFormat);
            }
            break;
        case "Array":
            if (value instanceof Array) {
                value = value.toString();
            }
            break;
        case "boolean":
            if (typeof value === "boolean") {
                if (value) {
                    return "t";
                } else {
                    return "f";
                }
            }
            break;
        case "int":
        case "float":
            if (typeof value === "number") {
                value = value + "";
            }
            break;
        }
        return value;
    }

    function getEncodedParams(params) {
        var encodedString = "";
        for (var prop in params) {
            if (params.hasOwnProperty(prop)) {
                if (encodedString.length > 0) {
                    encodedString += "&";
                }
                encodedString += encodeURI(prop + "=" + params[prop]);
            }
        }
        return encodedString;
    }

    var request = oui5lib.namespace("request");
    request.fetchJson = fetchJson;
    request.sendMappingRequest = sendMappingRequest;
}());
