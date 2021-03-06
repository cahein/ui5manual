/** @namespace oui5lib.mapping */
(function () {
    var listHelper = oui5lib.lib.listHelper;

    /**
     * Get the primary key of the entity.
     * @memberof oui5lib.mapping
     * @param {string} entityName The name of the entity.
     * @returns {string} The primaryKey property from the mapping.
     */
    function getPrimaryKey(entityName) {
        return getMapping(entityName).primaryKey;
    }

    function getEntityAttributeSpecs(entityName) {
        return getMapping(entityName).entity;
    }
    
    /**
     * Get the specification of an entity attribute.
     * @memberof oui5lib.mapping
     * @param {string} entityName The name of the entity.
     * @param {string} propertyPath The path of the entity attribute. Separate levels by '/'.
     * @returns {object} The specification from the mapping.
     */
    function getEntityAttributeSpec(entityName, propertyPath) {
        var attributeSpecs = getEntityAttributeSpecs(entityName);

        var pathLevels = propertyPath.split("/");
        if (pathLevels.length > 1) {
            var subPath, attributeSpec;
            for (var i = 0, s = pathLevels.length; i < s - 1; i++) {
                subPath = pathLevels[i];
                attributeSpec = listHelper.getItemByKey(attributeSpecs,
                                                        "name", subPath);
                if (attributeSpec === null) {
                    return null;
                }
                switch(attributeSpec.type) {
                case "object":
                    attributeSpecs = attributeSpec.objectItem;
                    break;
                case "array":
                    attributeSpecs = attributeSpec.arrayItem;
                    break;
                }
            }
            propertyPath = pathLevels[pathLevels.length - 1];
        }

        return listHelper.getItemByKey(attributeSpecs, "name", propertyPath);
    }
    
    /**
     * Get the definition of a request.
     * @memberof oui5lib.mapping
     * @param {string} entityName The name of the entity.
     * @param {string} requestName The name of the request.
     * @returns {object} The definition of the request from the mapping.
     */
    function getRequestConfig(entityName, requestName) {
        return getMapping(entityName).request[requestName];
    }

    var _mappings = {};

    /**
     * Get the mapping for the given entity. Will try to load the mapping if necessary.
     * @memberof oui5lib.mapping
     * @inner 
     * @param {string} entityName The name of the entity.
     * @returns {object} The mapping object.
     */
    function getMapping(entityName) {
        if (typeof _mappings[entityName] === "undefined") {
            loadMapping(entityName);
        }
        if(typeof _mappings[entityName] === "undefined") {
            throw new Error("couldn't load mapping for entity " + entityName);
        }
        return _mappings[entityName];
    }

    /**
     * Load the mapping file.
     * @memberof oui5lib.mapping
     * @inner 
     * @param {string} entityName The name of the entity.
     */
    function loadMapping(entityName) {
        var dir = oui5lib.configuration.getMappingDir();
        var url = dir + "/" + entityName + ".json";
        oui5lib.logger.error("load mapping: " + url);
        oui5lib.request.fetchJson(url, mappingLoaded, { entity: entityName }, false);
    }
    
    /**
     * Called after the mapping file was loaded.
     * @memberof oui5lib.mapping
     * @inner 
     * @param {object} mappingData The response JSON parsed into an object.
     * @param {object} requestProps The properties passed along with the request.
     */
    function mappingLoaded(mappingData, requestProps) {
        var entityName = requestProps.entity;
        
        if (typeof mappingData === "object") {
            if (mappingData.entity !== undefined &&
                mappingData.entity instanceof Array) {
                procArrayOfSpecifications(mappingData.entity, true);
            }
            if (mappingData.request !== undefined) {
                var requestDefaults = mappingData.request.defaults;
                for (var requestName in mappingData.request) {
                    if (requestName === "defaults") {
                        continue;
                    }
                    var requestConfig = mappingData.request[requestName];
                    if (requestDefaults !== undefined) {
                        setRequestDefaults(requestConfig, requestDefaults);
                    }
                    if (requestConfig.parameters !== undefined &&
                        requestConfig.parameters instanceof Array) {
                        procArrayOfSpecifications(requestConfig.parameters);
                    }
                }
            }
            _mappings[entityName] = mappingData;
        }
    }

    function procArrayOfSpecifications(specs, isEntityAttr) {
        if (specs === undefined) {
            return;
        }
        if (typeof isEntityAttr !== "boolean") {
            isEntityAttr = false;
        }

        specs.forEach(function(spec) {
            setDefaultProperties(spec);
            if (isEntityAttr) {
                setEntityAttributeDefaults(spec);
            }
            switch(spec.type) {
            case "array":
                procArrayOfSpecifications(spec.arrayItem);
                break;
            case "object":
                procArrayOfSpecifications(spec.objectItem);
                break;
            }
        });
    }

    function setDefaultProperties(spec) {
        if (typeof spec.type === "undefined") {
            spec.type = "string";
        }
        if (typeof spec.required !== "boolean") {
            spec.required = false;
        }
    }

    function setEntityAttributeDefaults(attributeSpec) {
        var tests = [];
        if (typeof attributeSpec.validate !== "undefined" &&
            attributeSpec.validate instanceof Array) {
            tests = attributeSpec.validate;
        }
        if (attributeSpec.required) {
            tests.push("required");
        }
        if (tests.length > 0) {
            attributeSpec.validate = tests;
        }
        
        if (typeof attributeSpec.i18n === "undefined") {
            attributeSpec.i18n = {};
        }
        if (typeof attributeSpec.ui5 === "undefined") {
            attributeSpec.ui5 = {};
        }
    }
    
    function setRequestDefaults(requestConfig, requestDefaults) {
        var defaultKeys = ["protocol", "host"];
        defaultKeys.forEach(function(key) {
            if (requestConfig[key] === undefined) {
                if (requestDefaults[key] !== undefined) {
                    requestConfig[key] = requestDefaults[key];
                }
            }
        });
        if (typeof requestConfig.method === "string" &&
            ["GET", "POST"].indexOf(requestConfig.method) > -1) {
            return;
        }
        requestConfig.method = "GET";
    }

    var mapping = oui5lib.namespace("mapping");
    mapping.getPrimaryKey = getPrimaryKey;
    mapping.getEntityAttributeSpecs = getEntityAttributeSpecs;
    mapping.getEntityAttributeSpec = getEntityAttributeSpec;
    mapping.getRequestConfiguration = getRequestConfig;
}());

