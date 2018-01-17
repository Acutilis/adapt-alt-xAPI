define([
  'coreJS/adapt',
  './xapiwrapper.min',
  './xapiMessageComposer',
], function(Adapt, xapiwrapper, msgComposer ) {

    Adapt.altxapi = _.extend({

    _MSG_COMPOSER: msgComposer,
    userInfo: {},
    _state: {},
    _sessionID: null,
    _config: null,
    _settingUpListeners: false,

    _wrapper: null,
    _STATE_ID: 'ACTIVITY_STATE',

    // data that might be set by the launch sequence. 
    _ACTOR: null,
    _REGISTRATION: null,
    _CTXT_ACTIVITIES: null, // necessary for adl-xapi-launch
    // END data that might be set by the launch sequence. 

    // Basic, default tracked messages
    _TRACKED_EVENTS: {
       altxapi: ['course:initialized',
                 'course:terminated'
       ],
       Adapt: [
        'router:menu',                                 // visited menu
        'router:page',                                 // visited page
        'assessments:complete',
        'questionView:recordInteraction'
       ],
       course: ['change:_isComplete'],
       components: ['change:_isComplete'],
       contentObjects: ['change:_isComplete', 'change:_isVisible' ]
    },


    initialize: function() {
      // Hold up setup while credentials and other key data is retrieved
      Adapt.trigger('plugin:beginWait');

      this.listenToOnce(Adapt, 'configModel:dataLoaded', this.onConfigLoaded);
      this.listenToOnce(Adapt, 'app:dataLoaded', this.onDataLoaded);
      this.listenToOnce(Adapt, 'adapt:start', this.onStart);
    },


    /*******************************************
    /*******      CONFIG  FUNCTIONS      *******
    /*******************************************/

    onConfigLoaded: function() {
      this._config = Adapt.config.has('_altxapi')
        ? Adapt.config.get('_altxapi')
        : false;

      if (!this._config)
        return false;

      if (!this.setConfigDefaultsAndCheck()) {
          Adapt.log.error('There are errors in the configuration. Aborting: xAPI tracking will not be activated.');
         return false;
      }

    },

    setConfigDefaultsAndCheck: function() {
      var config = this._config;
      // set defaults for missing values if necessary
      if (config._isEnabled == undefined)
          config._isEnabled = false;
      //TODO: check that _courseID is an IRI
      if (config._identifyById == undefined)
        config._identifyById = false;
      if (config._localLoggingOnly == undefined)
        config._localLoggingOnly = false;
      if (config._launchMethod == undefined)
        config._launchMethod =  'tincan';
      if (config._saveLoadState == undefined)
          config._saveLoadState = true;
      config._ignoreEvents = config._ignoreEvents || [];
      if (config._endPoint == undefined)
        config._endPoint = '';
      if (config._userName == undefined)
        config._userName = '';
      if (config._password == undefined)
        config._password = '';
      if (config._mbox == undefined)
        config._mbox = 'mailto:johndoe@example.com';
      if (config._fullName == undefined)
        config._fullName = 'John Doe';
      if (config._homePage == undefined)
        config._homePage = '';

      // check types of parameters
      if (!(
           ( _.isBoolean(config._isEnabled)) &&
           (_.isString(config._courseID) && !_.isEmpty(config._courseID)) &&
           ( _.isBoolean(config._identifyById)) &&
           ( _.isBoolean(config._localLoggingOnly)) &&
           ( _.isString(config._launchMethod)) &&
           ( _.isBoolean(config._saveLoadState)) &&
           ( _.isArray(config._ignoreEvents)) &&
           ( _.isString(config._endPoint)) &&
           ( _.isString(config._userName)) &&
           ( _.isString(config._password)) &&
           ( _.isString(config._mbox)) &&
           ( _.isString(config._fullName)) &&
           ( _.isString(config._homePage)) 
          )
         ) {
          return false;
      }

      return true;
    },

    checkStrictTitles: function() {
      var idsWithEmptyTitles = [];
      var uniqueTitles = [];
      var repeatedTitles = [];
      var msg = '';
      var result = true;
      _.each(Adapt.components.models, function(componentModel) {
        var t = componentModel.get('title');
        if (t.trim() == '') {
            idsWithEmptyTitles.push(componentModel.get('_id'));
        } else {
          if ( _.indexOf(uniqueTitles, t) == -1 ) {
              uniqueTitles.push(t);
          } else {
              repeatedTitles.push(t);
          }
        }
      });
      if (idsWithEmptyTitles.length > 0) {
          msg += 'The components with the following Ids have empty titles:\n';
          _.each(idsWithEmptyTitles, function(id) {
              msg = msg + id + '\n';
          });
      }
      if (repeatedTitles.length > 0) {
          msg += 'The following titles are assigned to more than one component:\n';
          _.each(repeatedTitles, function(title) {
              msg = msg + title + '\n';
          });
      }
      if(msg.length > 0) {
          msg += 'PLEASE FIX TITLES. xAPI tracking aborted. It will NOT work.';
          alert(msg);
          result = false;
      }
      return result;
    },

    applyConfig: function() {
      var config = this._config;
      Adapt.log.debug('adapt-alt-xapi applying config.');
      if (config._launchMethod != 'adlxapi')  {
          // if the launch method was adlxapi, by now the _wrapper was already assigned by the launch function
        var conf = { actor: this._ACTOR, registration: this._REGISTRATION };
        conf.strictCallbacks = true;
        _.extend(conf, {"endpoint": config._endPoint} );
        _.extend(conf, {"auth": "Basic " + toBase64(config._userName + ":" + config._password) });
        this._wrapper = new XAPIWrapper(conf, false);
      }
    },

    /*******  END CONFIG FUNCTIONS *******/


    /*******************************************
    /*******  LAUNCH SEQUENCE  FUNCTIONS *******
    /*******************************************/

    onDataLoaded: function() {
      // Check strict titles.
      if (this._config._isEnabled && !this._config._identifyById) {
          if (!this.checkStrictTitles()) {
              return
          }
      }

      // Hold up setup while credentials and other key data is retrieved

      // start launch sequence -> loadState -> setupInitialEventListeners... do this asynchronously
      Adapt.log.debug('adapt-alt-xapi: starting launch sequence...');
      this.listenToOnce(this, 'launchSequenceFinished', this.onLaunchSequenceFinished);
      // Use introspection. Just call the appropriate function if it exists.
      var launchFName = 'launch_' + this._config._launchMethod.toLowerCase();
      if (this.hasOwnProperty(launchFName)) {
          this[launchFName]();
      } else {
          alert('Unknown launch method (' + this._config._launchMethod + ') specified in the configuration file. Please fix it. xAPI content cannot be loaded and tracked without a proper launch. Aborting.');
          window.location.href = '/';
      }
    },

    launch_hardcoded: function() {
        Adapt.log.debug('adapt-alt-xapi: starting hardcoded launch sequence...');
        Adapt.altxapi.userInfo.mbox =  this._config._mbox;
        Adapt.altxapi.userInfo.fullName =  this._config._fullName;
        // in the harcoded launch, the channel._endPoint is taken from the config file, so no need to set it here.
        this._ACTOR = new ADL.XAPIStatement.Agent(Adapt.altxapi.userInfo.mbox, Adapt.altxapi.userInfo.fullName);
        Adapt.log.debug('adapt-alt-xapi: hardcoded launch sequence finished.');
        this.trigger('launchSequenceFinished');
    },

    launch_tincan: function() {
        Adapt.log.debug('adl-alt-xapi: starting tincan launch sequence...');
        // The format of the launch query string is:
        //<AP URL>/?endpoint=<lrsendpoint>&auth=<token>&actor=<learner>[&registration=<registration>][&activity_id=<activity ID>
        //[&activity_platform=<platform>][&Accept-Language=<acceptlanguage>][&grouping=<grouping activity ID>]
        var qs = this.queryString();
        var actor = JSON.parse(qs.actor);
        this.userInfo.mbox =  actor.mbox;
        this.userInfo.fullName =  actor.name;
        // in the tincan launch, the _endPoint is taken from  the query param
        this._config._endPoint = qs['endpoint'] 
        this._ACTOR = new ADL.XAPIStatement.Agent(actor.mbox, actor.name);
        this._LANG = qs['Accept-Language'];
        if (qs.activity_id) {
          this._config._courseID = qs.activity_id;
        }
        if (qs.registration) {
          this._REGISTRATION = qs.registration;
        }
        Adapt.log.debug('adl-alt-xapi: tincan launch sequence finished.');
        this.trigger('launchSequenceFinished');
    },

    launch_adlxapi: function() {
        Adapt.log.debug('adapt-alt-xapi: starting launch sequence...');
        // adl xapi launch functionality is provided by the xAPIwrapper, so we just do as
        // explained in https://github.com/adlnet/xAPIWrapper#xapi-launch-support
        var aax = this; // save reference to 'this' (adapt-alt-xapi), because I need it in the ADL.launch callback
        ADL.launch(function(err, launchdata, xAPIWrapper) {
          if (!err) {
            // the 'launch' function provided by xAPIWrapper already returns a pre-made xAPIWrapper, and
            // we MUST use that (it takes care of the cookie etc.)
            aax._wrapper = xAPIWrapper;  //this was _PREBUILTWRAPPER
            // But other parts of the code rely on individual pieces of data (such as _ACTOR) even though
            // they exist in the pre-built wrapper, so we set those here
            aax._config._endPoint = launchdata.endpoint;
            aax._ACTOR = new ADL.XAPIStatement.Agent(launchdata.actor);
            aax._CTXT_ACTIVITIES = launchdata.contextActivities;
            Adapt.log.debug('adapt-alt-xapi: adlxapi (xapi-launch) launch sequence finished.');
            aax.trigger('launchSequenceFinished');
          } else {
            alert('ERROR: could not get xAPI data from xAPI-launch server!. xAPI tracking aborted.');
          }
        }, true, true);
    },

    launch_spoor: function() {
        // the LRS data is read from the config file (it is basically harcoded into the content)
        // and the user id is retrieved through the LMS (the SCORM API)
        var studentID = pipwerks.SCORM.data.get("cmi.core.student_id"); // hard assumption on SCORM 1.2
        // I'd rather use Spoor's ScormWrapper.getStudentId() ... but I don't know how/if Spoor exposes part of its internal functionality
        var accountObj = { homePage: this._config._homePage,
                           name: studentID
        }
        this.userInfo.account =  accountObj;
        // in the spoor launch, the channel._endPoint is set through the configuration file, so no need to set it here
        this._ACTOR = new ADL.XAPIStatement.Agent(accountObj);
        this.trigger('launchSequenceFinished');
    },

    /*******  END LAUNCH SEQUENCE FUNCTIONS *******/




    /*******************************************
    /******* GENERAL  UTILITY  FUNCTIONS *******
    /*******************************************/

    queryString: function() {
      var query_string = {};
      var query = window.location.search.substring(1);
      var vars = query.split("&");
      for (var i=0;i<vars.length;i++) {
        var pair = vars[i].split("=");
        if (typeof query_string[pair[0]] === "undefined") {
          query_string[pair[0]] = decodeURIComponent(pair[1]);
        } else if (typeof query_string[pair[0]] === "string") {
          var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
          query_string[pair[0]] = arr;
        // If third or later entry with this name
        } else {
          query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
      }
      return query_string;
    },

    /*!
    Excerpt from: Math.uuid.js (v1.4)
    http://www.broofa.com
    mailto:robert@broofa.com
    Copyright (c) 2010 Robert Kieffer
    Dual licensed under the MIT and GPL licenses.
    */
    genUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
        });
    },


    /*******  END GENERAL UTILITY FUNCTIONS *******/




    /*******************************************
    /******* STATE MANAGEMENT  FUNCTIONS *******
    /*******************************************/


    onLaunchSequenceFinished: function(ev) {
      Adapt.log.debug('launch sequence finished.');
      // once the launch seq is finished (we have the user identity) we can apply the config
      this.applyConfig();
      // once the launch seq is complete, let's attempt to load state
      this.listenToOnce(this, 'stateLoaded', this.onStateLoaded);
      if (this._config._saveLoadState) {
          this.loadState();
      }
      else {
        this.trigger('stateLoaded', null);
      }
    },

    updateState: function() {
      // Our state representation  is an object with collections for the major
      // model types. Each collections' keys are the titles of the components, (or ids,
      // depending on config. titles are the default, and preferred) and the values are
      // objects with the attributes that begin with '_'.
      // State representation, updating, and saing is not efficient. Should be flatter for improved LRS interaction.
      var localState = {
        contentObjects: {},
        articles: {},
        blocks: {},
        components: {}
      };

      // These are the attributes that we want to save (if they exist in the component)
      var componentProps = [
        '_canReset', '_canShowFeedback', '_isAvailable', '_isComplete', '_isEnabled',
        '_isInteractionComplete', '_isLocked', '_isOptional', '_isResetOnRevisit',
        '_isVisible', '_requireCompletionOf', '_attempts', '_canShowMarking',
        '_canShowModelAnswer', '_isAtLeastOneCorrectSelection', '_isRandom',
        '_isSubmitted', '_questionWeight', '_shouldDisplayAttempts', '_userAnswer'
      ];
      _.each(Adapt.components.models, function(component) {
        var key = Adapt.altxapi.getElementKey(component);
        localState.components[key] = _.pick(component.attributes, componentProps);
      }, this);

      var blockProps = [
        '_isComplete', '_isInteractionComplete', '_isLocked'
      ];
      _.each(Adapt.blocks.models, function(block) {
        var key = Adapt.altxapi.getElementKey(block);
        localState.blocks[key] = _.pick(block.attributes, blockProps);
      });

      var articleProps = [
        '_isComplete', '_isInteractionComplete', '_isLocked', '_questions',
        '_attemptInProgress', '_attemptsLeft', '_attemptsSpent', '_isAssessmentComplete',
        '_scoreAsPercent', '_score', '_lastAttemptScoreAsPrecent', '_isPass', '_maxScore'
      ];
      _.each(Adapt.articles.models, function(article) {
        var key = Adapt.altxapi.getElementKey(article);
        localState.articles[key] = _.pick(article.attributes, articleProps);
      });

      var contentProps = [
        '_isComplete', '_isInteractionComplete', '_isLocked', '_isVisited'
      ];
      _.each(Adapt.contentObjects.models, function(contentObject) {
        var key = Adapt.altxapi.getElementKey(contentObject);
        localState.contentObjects[key] = _.pick(contentObject.attributes, contentProps);
      });

      this._state = localState;
    },

    loadState: function() {
      if (!this._config._saveLoadState) 
          return;
      Adapt.log.debug('adapt-alt-xapi: loading State');
      this._wrapper.getState(this._config._courseID, this._ACTOR, this._STATE_ID, this._REGISTRATION, null, _.bind(function(err, xhr) {
        if (err) {
          alert('Error loading state.');
          throw err;
        }
        var stateStr;
        if (xhr.status == 404) {
            stateStr = '{}';
        } else {
            stateStr = xhr.response;
        }
        Adapt.log.debug('adapt-alt-xapi: state loaded');
        var state = JSON.parse(stateStr);
        this.trigger('stateLoaded', state);
      }, this));
    },

    onStateLoaded: function(fullState) {
        if (fullState) {
            Adapt.log.debug('state loaded');
            this._state = fullState;
            this.applyStateToStructure();
        }
      // Retrieval completed. This plugin is done doings its things
      window.addEventListener("beforeunload", this.terminatexAPI);

      Adapt.trigger('plugin:endWait');
    },

    terminatexAPI: function(ev) {
       Adapt.altxapi.trigger('course:terminated');
       Adapt.altxapi.saveState(); 
    },

    saveState: function() {
        if (!this._config._saveLoadState)
            return;
      Adapt.log.debug('adapt-alt-xapi: saving state');
      this._wrapper.sendState(this._config._courseID, this._ACTOR, this._STATE_ID, this._REGISTRATION, this._state, '*', '*',_.bind(function(err) {
        if (err) {
          alert('Error saving state.');
          throw err;
        }
        Adapt.log.debug('adapt-alt-xapi state saved');
      }, this));
    },


    onStart: function() {
      Adapt.log.debug('bind event listeners');

      this.setupInitialEventListeners();
      this.trigger('course:initialized');
    },

    applyStateToStructure: function() {
      var localState = this._state;

      if (!localState) {
        Adapt.log.debug('adapt-alt-xapi no state to apply to structure...');
        return;
      }


      // Walk through all components, blocks, articles, and contentObjects,
      // update their '_' attributes with what there is in localState.

      _.each(Adapt.components.models, function(component) {
        var key = this._config._identifyById ? component.get('_id') :
            this.titleToKey(component.get('title'));
        if (_.has(localState.components, key)) {
          component.set(localState.components[key]);
        }
      }, this);

      _.each(Adapt.blocks.models, function(block) {
        var key = this._config._identifyById ? block.get('_id') :
            this.titleToKey(block.get('title'));
        if (_.has(localState.blocks, key)) {
          block.set(localState.blocks[key]);
        }
      }, this);

      _.each(Adapt.articles.models, function(article) {
        var key = this._config._identifyById ? article.get('_id') :
            this.titleToKey(article.get('title'));
        if (_.has(localState.articles, key)) {
          article.set(localState.articles[key]);
        }
      }, this);

      _.each(Adapt.contentObjects.models, function(contentObject) {
        var key = this._config._identifyById ? contentObject.get('_id') :
            this.titleToKey(contentObject.get('title'));
        if (_.has(localState.contentObjects, key)) {
          contentObject.set(localState.contentObjects[key]);
        }
      }, this);

      Adapt.log.debug('adapt-alt-xapi state applied to structure...');
    },


    /*******  END STATE MANAGEMENT FUNCTIONS *******/


    setupInitialEventListeners: function() {
      this._settingUpListeners = true; // turn on control flag
      Adapt.log.debug('setting up initial event listeners (for tracked messages)');
      _.each(_.keys(this._TRACKED_EVENTS), function (eventSourceName) {
        _.each(this._TRACKED_EVENTS[eventSourceName], function (eventName) {
          this.addLocalEventListener(eventSourceName, eventName);
        },this);
      },this);

      Adapt.log.debug('FINISHED setting up initial event listeners...');
      this._settingUpListeners = false;
    },

    getObjFromEventSourceName: function (eventSourceName) {
      var obj = null;
      // TODO: do this with an object? (name is key, value is the target object)
      switch (eventSourceName.toLowerCase()) {
        case 'altxapi': obj = this; break;
        case 'adapt': obj = Adapt; break;
        case 'course': obj = Adapt.course; break;
        case 'blocks': obj = Adapt.blocks; break;
        case 'components': obj = Adapt.components; break;
        case 'contentobjects': obj = Adapt.contentObjects; break;
      };
      return obj;
    },

    addCustomEventListener: function(eventSource, eventSourceName, eventName) {
      this.listenTo(eventSource, eventName, function (args) {
        this.processTrackedEvent(args, eventSourceName, eventName);
      }, this);
    },

    removeCustomEventListener: function(eventSource, eventName) {
      var sourceObj;
      var eventSourceName;

      if (_.isString(eventSource)) {
        eventSourceName = eventSource;
        sourceObj = this.getObjFromEventSourceName(eventSourceName);
      } else {
        sourceObj = eventSource;
        eventSourceName = sourceObj._CHID;
      }
      this.stopListening(sourceObj, eventName);
    },

    addLocalEventListener: function(eventSourceName, eventName) {
      var sourceObj = this.getObjFromEventSourceName(eventSourceName);
      this.listenTo(sourceObj, eventName, function (args) {
        // only allow some events to be dispatched as the listeners are being set up.
        var allowedEvents = ['router:menu', 'navigationView:preRender'];
        if (!this._settingUpListeners || _.indexOf(allowedEvents, eventName)!=-1) {    //only dispatch if control flag is off (e.g. we're not in the initial setup stage)
            this.processTrackedEvent(args, eventSourceName, eventName);
        }
      }, this);
    },

    processTrackedEvent: function(args, eventSourceName, eventName) {
      // just compose & deliver the message corresponding to this event
      var isEventIgnored = _.contains(this._config._ignoreEvents,eventName);
      if (!isEventIgnored) {
        var message = msgComposer.compose(eventSourceName, eventName, args) 
        if (message) {
          // in this case, the message is an INCOMPLETE xAPI statement, it's missing the Actor.
          // We add it here
          if (! message.actor) {
              message.actor = this._ACTOR;
          }
          message.context = message.context || {};
          if (! message.context.contextActivities && this._CTXT_ACTIVITIES) {
              message.context.contextActivities = this._CTXT_ACTIVITIES;
          }
          this.deliverMsg(message);
        }
      }

      // If we needed to do specific processing for specific events, we would do it here.
      // funcName = Adapt.trackingHub.getValidFunctionName(eventSourceName, eventName);
      // if (this.hasOwnProperty(funcName)) {
      //   this[funcName](args);
      // }

      // If there's any common processing that we need to do, no matter what event happened, do it here.
      this.updateState();
      this.saveState();
    },

    deliverMsg: function(message) {
        if (!this._config._localLoggingOnly) {
            this._wrapper.sendStatement(message, _.bind(function(err) {
              if (err) {
                  Adapt.log.error('Error sending statement.');
                throw err;
              }
              Adapt.log.info('Statement sent', message);
            }, this));
        } else {
              Adapt.log.info('Statement processed but NOT sent (local logging only)', message);
        }
    },

    getValidFunctionName: function (eventSourceName, eventName) {
        var s = (eventSourceName + '_' + eventName.replace(/:/g, "_"));
        s = s.replace(/-/g, "_");
        return s;
    },

    getElementKey: function(obj) {
        // checks the config to see if the 'key' (unique identifier) of a Component, block, article, or contentObject
        // should be the _id or the title
        var key = null;
        this._config._identifyById ?
            key = obj.get('_id')
            :
            key = this.titleToKey(obj.get('title'));
       return key;
    },

    titleToKey: function(str) {
        // replace spaces with '_' and lowercase all
        return str.replace(/[\?’,.:\s]/g, "_").toLowerCase();
    },

  }, Backbone.Events);

  Adapt.altxapi.initialize();
  return (Adapt.altxapi);
});
