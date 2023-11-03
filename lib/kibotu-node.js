/*
    Heavily inspired by the original js library copyright Kibotu, Inc.
    (http://kibotu.ai/)

    Copyright (c) 2012 Carl Sverre

    Released under the MIT license.
*/

const querystring = require('querystring');
const Buffer = require('buffer').Buffer;
const http = require('http');
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');
const url = require('url');
const packageInfo = require('../package.json')

const {async_all, ensure_timestamp} = require('./utils');
const {KibotuGroups} = require('./groups');
const {KibotuPeople} = require('./people');

const DEFAULT_CONFIG = {
    test: false,
    debug: false,
    verbose: false,
    host: 'api.kibotu.ai', // 'localhost',//'api.kibotu.ai',
    // port: '5757',
    protocol: 'https', // 'http',
    path: '',
    keepAlive: true,
    // set this to true to automatically geolocate based on the client's ip.
    // e.g., when running under electron
    geolocate: false,
};

var create_client = function (token, config) {
    if (!token) {
        throw new Error("The Kibotu Client needs a Kibotu token: `init(token)`");
    }

    const metrics = {
        token,
        config: {...DEFAULT_CONFIG},
    };
    const {keepAlive} = metrics.config;

    // kibotu constants
    const MAX_BATCH_SIZE = 50;
    const REQUEST_LIBS = {http, https};
    const REQUEST_AGENTS = {
        http: new http.Agent({keepAlive}),
        https: new https.Agent({keepAlive}),
    };
    const proxyPath = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const proxyAgent = proxyPath ? new HttpsProxyAgent(Object.assign(url.parse(proxyPath), {
        keepAlive,
    })) : null;

    /**
     * sends an async GET or POST request to kibotu
     * for batch processes data must be send in the body of a POST
     * @param {object} options
     * @param {string} options.endpoint
     * @param {object} options.data         the data to send in the request
     * @param {string} [options.method]     e.g. `get` or `post`, defaults to `get`
     * @param {function} callback           called on request completion or error
     */
    metrics.send_request = function (options, callback) {
        callback = callback || function () {
        };

        if (!Array.isArray(options.data) && !options.jsonObjectRequest) {
            options.data = [options.data];
        }
        let content = JSON.stringify(options.data);// Buffer.from(JSON.stringify(options.data)).toString('base64');
        const endpoint = options.endpoint;
        const method = (options.method || 'POST').toUpperCase();
        let query_params = {
            'ip': metrics.config.geolocate ? 1 : 0,
            'verbose': metrics.config.verbose ? 1 : 0
        };
        // const key = metrics.config.key;
        // const secret = metrics.config.secret;
        const request_lib = REQUEST_LIBS[metrics.config.protocol];
        let request_options = {
            host: metrics.config.host,
            port: metrics.config.port,
            headers: {},
            method: method
        };
        let request;

        if (!request_lib) {
            throw new Error(
                "Kibotu Initialization Error: Unsupported protocol " + metrics.config.protocol + ". " +
                "Supported protocols are: " + Object.keys(REQUEST_LIBS)
            );
        }


        if (method === 'POST') {
            // content = 'data=' + content;
            request_options.headers['Content-Type'] = 'application/json'; // 'application/x-www-form-urlencoded';
            request_options.headers['Content-Length'] = Buffer.byteLength(content);
        } else if (method === 'GET') {
            query_params.data = content;
        }


        // add auth params
        // if (secret) {
        //     if (request_lib !== https) {
        //         throw new Error("Must use HTTPS if authenticating with API Secret");
        //     }
        //     const encoded = Buffer.from(secret + ':').toString('base64');
        //     request_options.headers['Authorization'] = 'Basic ' + encoded;
        // } else if (key) {
        //     query_params.api_key = key;
        if (metrics.token) {
            request_options.headers['Authorization'] = metrics.token;
        } else if (endpoint === '/import') {
            throw new Error("The Kibotu Client needs a Kibotu API Secret when importing old events: `init(token, { secret: ... })`");
        }

        request_options.agent = proxyAgent || REQUEST_AGENTS[metrics.config.protocol];

        if (metrics.config.test) {
            query_params.test = 1;
        }

        request_options.path = metrics.config.path + endpoint + "?" + querystring.stringify(query_params);

        request = request_lib.request(request_options, function (res) {
            var data = "";
            res.on('data', function (chunk) {
                data += chunk;
            });

            res.on('end', function () {
                var e;
                if (options.parseJsonResponse === true) {
                    try {
                        var result = JSON.parse(data);
                        return callback(null, result);
                    } catch (ex) {
                        e = new Error("Could not parse response from Kibotu");
                    }
                } else if (metrics.config.verbose) {
                    try {
                        var result = JSON.parse(data);
                        if (result.status != 1) {
                            e = new Error("Kibotu Server Error: " + result.error);
                        }
                    } catch (ex) {
                        e = new Error("Could not parse response from Kibotu");
                    }
                } else {
                    e = (data !== '1') ? new Error("Kibotu Server Error: " + data) : undefined;
                }

                callback(e);
            });
        });

        request.on('error', function (e) {
            if (metrics.config.debug) {
                console.log("Got Error: " + e.message);
            }
            callback(e);
        });

        if (method === 'POST') {
            request.write(content);
        }
        request.end();
    };

    /**
     * Send an event to Kibotu, using the specified endpoint (e.g., track/import)
     * @param {string} endpoint - API endpoint name
     * @param {string} event - event name
     * @param {object} properties - event properties
     * @param {Function} [callback] - callback for request completion/error
     */
    metrics.send_event_request = function (endpoint, event, properties, callback) {
        properties.token = metrics.token;
        properties.mp_lib = "node";
        properties.$lib_version = packageInfo.version;

        var data = {
            event: event,
            properties: properties
        };

        if (metrics.config.debug) {
            console.log("Sending the following event to Kibotu:\n", data);
        }

        metrics.send_request({endpoint: endpoint, data: data}, callback);
    };

    /**
     * breaks array into equal-sized chunks, with the last chunk being the remainder
     * @param {Array} arr
     * @param {number} size
     * @returns {Array}
     */
    var chunk = function (arr, size) {
        var chunks = [],
            i = 0,
            total = arr.length;

        while (i < total) {
            chunks.push(arr.slice(i, i += size));
        }
        return chunks;
    };

    /**
     * sends events in batches
     * @param {object}   options
     * @param {[{}]}     options.event_list                 array of event objects
     * @param {string}   options.endpoint                   e.g. `/track` or `/import`
     * @param {number}   [options.max_concurrent_requests]  limits concurrent async requests over the network
     * @param {number}   [options.max_batch_size]           limits number of events sent to kibotu per request
     * @param {Function} [callback]                         callback receives array of errors if any
     *
     */
    var send_batch_requests = function (options, callback) {
        var event_list = options.event_list,
            endpoint = options.endpoint,
            max_batch_size = options.max_batch_size ? Math.min(MAX_BATCH_SIZE, options.max_batch_size) : MAX_BATCH_SIZE,
            // to maintain original intention of max_batch_size; if max_batch_size is greater than 50, we assume the user is trying to set max_concurrent_requests
            max_concurrent_requests = options.max_concurrent_requests || (options.max_batch_size > MAX_BATCH_SIZE && Math.ceil(options.max_batch_size / MAX_BATCH_SIZE)),
            event_batches = chunk(event_list, max_batch_size),
            request_batches = max_concurrent_requests ? chunk(event_batches, max_concurrent_requests) : [event_batches],
            total_event_batches = event_batches.length,
            total_request_batches = request_batches.length;

        /**
         * sends a batch of events to kibotu through http api
         * @param {Array} batch
         * @param {Function} cb
         */
        function send_event_batch(batch, cb) {
            if (batch.length > 0) {
                batch = batch.map(function (event) {
                    var properties = event.properties;
                    if (endpoint === '/import' || event.properties.time) {
                        // usually there will be a time property, but not required for `/track` endpoint
                        event.properties.time = ensure_timestamp(event.properties.time);
                    }
                    event.properties.token = event.properties.token || metrics.token;
                    return event;
                });

                // must be a POST
                metrics.send_request({method: "POST", endpoint: endpoint, data: batch}, cb);
            }
        }

        /**
         * Asynchronously sends batches of requests
         * @param {number} index
         */
        function send_next_request_batch(index) {
            var request_batch = request_batches[index],
                cb = function (errors, results) {
                    index += 1;
                    if (index === total_request_batches) {
                        callback && callback(errors, results);
                    } else {
                        send_next_request_batch(index);
                    }
                };

            async_all(request_batch, send_event_batch, cb);
        }

        // init recursive function
        send_next_request_batch(0);

        if (metrics.config.debug) {
            console.log(
                "Sending " + event_list.length + " events to Kibotu in " +
                total_event_batches + " batches of events and " +
                total_request_batches + " batches of requests"
            );
        }
    };

    /**
     track(event, properties, callback)
     ---
     this function sends an event to kibotu.

     event:string                    the event name
     properties:object               additional event properties to send
     callback:function(err:Error)    callback is called when the request is
     finished or an error occurs
     */
    metrics.track = function (event, properties, callback) {
        if (!properties || typeof properties === "function") {
            callback = properties;
            properties = {};
        }

        // time is optional for `track`
        if (properties.time) {
            properties.time = ensure_timestamp(properties.time);
        }

        metrics.send_event_request("/track", event, properties, callback);
    };

    /**
     * send a batch of events to kibotu `track` endpoint: this should only be used if events are less than 5 days old
     * @param {Array}    event_list                         array of event objects to track
     * @param {object}   [options]
     * @param {number}   [options.max_concurrent_requests]  number of concurrent http requests that can be made to kibotu
     * @param {number}   [options.max_batch_size]           number of events that can be sent to kibotu per request
     * @param {Function} [callback]                         callback receives array of errors if any
     */
    metrics.track_batch = function (event_list, options, callback) {
        options = options || {};
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        var batch_options = {
            event_list: event_list,
            endpoint: "/track",
            max_concurrent_requests: options.max_concurrent_requests,
            max_batch_size: options.max_batch_size
        };

        send_batch_requests(batch_options, callback);
    };

    /**
     import(event, time, properties, callback)
     ---
     This function sends an event to kibotu using the import
     endpoint.  The time argument should be either a Date or Number,
     and should signify the time the event occurred.

     It is highly recommended that you specify the distinct_id
     property for each event you import, otherwise the events will be
     tied to the IP address of the sending machine.

     For more information look at:
     https://kibotu.ai/docs/api-documentation/importing-events-older-than-31-days

     event:string                    the event name
     time:date|number                the time of the event
     properties:object               additional event properties to send
     callback:function(err:Error)    callback is called when the request is
     finished or an error occurs
     */
    metrics.import = function (event, time, properties, callback) {
        if (!properties || typeof properties === "function") {
            callback = properties;
            properties = {};
        }

        properties.time = ensure_timestamp(time);

        metrics.send_event_request("/import", event, properties, callback);
    };

    /**
     import_batch(event_list, options, callback)
     ---
     This function sends a list of events to kibotu using the import
     endpoint. The format of the event array should be:

     [
     {
                "event": "event name",
                "properties": {
                    "time": new Date(), // Number or Date; required for each event
                    "key": "val",
                    ...
                }
            },
     {
                "event": "event name",
                "properties": {
                    "time": new Date()  // Number or Date; required for each event
                }
            },
     ...
     ]

     See import() for further information about the import endpoint.

     Options:
     max_batch_size: the maximum number of events to be transmitted over
     the network simultaneously. useful for capping bandwidth
     usage.
     max_concurrent_requests: the maximum number of concurrent http requests that
     can be made to kibotu; also useful for capping bandwidth.

     N.B.: the Kibotu API only accepts 50 events per request, so regardless
     of max_batch_size, larger lists of events will be chunked further into
     groups of 50.

     event_list:array                    list of event names and properties
     options:object                      optional batch configuration
     callback:function(error_list:array) callback is called when the request is
     finished or an error occurs
     */
    metrics.import_batch = function (event_list, options, callback) {
        var batch_options;

        if (typeof (options) === "function" || !options) {
            callback = options;
            options = {};
        }
        batch_options = {
            event_list: event_list,
            endpoint: "/import",
            max_concurrent_requests: options.max_concurrent_requests,
            max_batch_size: options.max_batch_size
        };
        send_batch_requests(batch_options, callback);
    };

    /**
     alias(distinct_id, alias)
     ---
     This function creates an alias for distinct_id

     For more information look at:
     https://kibotu.ai/docs/integration-libraries/using-kibotu-alias

     distinct_id:string              the current identifier
     alias:string                    the future alias
     */
    metrics.alias = function (distinct_id, alias, callback) {
        var properties = {
            distinct_id: distinct_id,
            alias: alias
        };

        metrics.track('$create_alias', properties, callback);
    };

    metrics.groups = new KibotuGroups(metrics);
    metrics.people = new KibotuPeople(metrics);

    /**
     set_config(config)
     ---
     Modifies the kibotu config

     config:object       an object with properties to override in the
     kibotu client config
     */
    metrics.set_config = function (config) {
        Object.assign(metrics.config, config);
        if (config.host) {
            // Split host into host and port
            const [host, port] = config.host.split(':');
            metrics.config.host = host;
            if (port) {
                metrics.config.port = Number(port);
            }
        }
    };

    /**
     * getFeature
     * ---
     * Personalized feature from Kibotu
     *
     * featureName:string                  feature id / key / name
     * distinct_id:string                  unit identified, i.e. user id
     * predict_id:string                   prediction flow/scope id
     * propOverrides:object                an object with entity properties to be overridden
     * callback:function(err:Error)        callback is called when the request is
     *                                     finished or an error occurs
     */
    metrics.getFeature = function (featureName, distinct_id, predict_id, propOverrides, callback) {
        return metrics.get_feature(featureName, distinct_id, predict_id, propOverrides, callback);
    }

    metrics.get_feature = function (featureName, distinct_id, predict_id, propOverrides, callback) {
        metrics.send_request({
                jsonObjectRequest: true,
                method: "POST", endpoint: '/feature', data: {
                    featureName: featureName,
                    distinct_id: distinct_id,
                    predict_id: predict_id,
                    propOverrides: propOverrides,
                }
            },
            callback);
    };

    metrics.get_personalized_banner = function (userId,
                                                activeChamp,
                                                offerId,
                                                prizeTypes,
                                                postalCode,
                                                callback) {
        metrics.send_request({
                jsonObjectRequest: true,
                method: "POST",
                endpoint: '/ab/getPersonalizedBanner',
                parseJsonResponse: true,
                data: {
                    userId: userId,
                    activeChamp: activeChamp,
                    offerId: offerId,
                    prizeTypes: prizeTypes,
                    postalCode: postalCode
                }
            },
            callback);
    };

    /**
     * getSpecialOffer
     * ---
     * Personalized special_offer from Kibotu
     *
     * trigger:string                      trigger id / key / name
     * distinct_id:string                  user unique identifier, i.e. user id
     * predict_id:string                   prediction flow/scope id
     */
    metrics.getSpecialOffer = async function (trigger, distinct_id, predict_id) {
        return metrics.get_special_offer(trigger, distinct_id, predict_id);
    }

    metrics.get_special_offer = async function (trigger, distinct_id, predict_id) {
        const featureName = `special_offer_on_${trigger}`;
        return new Promise((resolve, reject) => {
            metrics.send_request({
                    jsonObjectRequest: true,
                    method: "POST",
                    endpoint: '/feature',
                    parseJsonResponse: true,
                    data: {
                        featureName,
                        distinct_id,
                        predict_id,
                    }
                },
                (err, res) => {
                    if (err) {
                        console.error(`get_special_offer failed for trigger: ${trigger}, distinct_id: ${distinct_id}, predict_id: ${predict_id}; Error: ${err}`);
                        resolve({});
                    } else if (res?.specialOffer) {
                        resolve(res?.specialOffer);
                    } else {
                        console.error(`get_special_offer no specialOffer for trigger: ${trigger}, distinct_id: ${distinct_id}, predict_id: ${predict_id}; res: ${JSON.stringify(res)}`);
                        resolve({});
                    }
                });
        });
    };

    if (config) {
        metrics.set_config(config);
    }

    return metrics;
};

// module exporting
module.exports = {
    Client: function (token) {
        console.warn("The function `Client(token)` is deprecated. It is now called `init(token)`.");
        return create_client(token);
    },
    init: create_client
};
