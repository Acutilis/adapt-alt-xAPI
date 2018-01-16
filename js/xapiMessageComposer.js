define([ 'coreJS/adapt',
], function(Adapt) {

  var XapiMessageComposer = _.extend({

    _NAME: 'xapiMessageComposer',
    xapiCustom: { verbs: {}, activityTypes: {} },
    _ATB: 'http://adaptlearning.org/xapi/activities/',

    initialize: function() {
      this.setCustomVerbs();
    },

    compose: function (eventSourceName, eventName, args, template) {
      var statementParts;
      var statement;
      var timestamp = new Date(Date.now()).toISOString();

      funcName = Adapt.altxapi.getValidFunctionName(eventSourceName, eventName);
      if (this.hasOwnProperty(funcName)) {
        statement = new ADL.XAPIStatement();
        statement.timestamp = timestamp;

        // if _generateIds is true/undefined, then generate ids locally
        if (!Adapt.altxapi._config || (_.isUndefined(Adapt.altxapi._config._generateIds || Adapt.altxapi._config._generateIds))) {
          statement.generateId();
        }

        // Call the specific composing function for this event
        // it will add things to the statement.
        this[funcName](statement,args);
        return (statement);
      }
      return (null);
    },


    getXAPIResponse: function(view) {
      var type = view.getResponseType();
      var response = view.getResponse();

      //, choice, fill-in, long-fill-in, matching, performance, sequencing, likert, numeric or other
      switch(type) {
      case 'true-false':
        if (!response || response === "false" || response === "0") {
          return 'false';
        }

        return 'true';
      case 'performance':
      case 'sequencing':
      case 'choice':
        var selected = response.split(',');
        return selected.join('[,]');
      case 'fill-in':
      case 'long-fill-in':
        return response;
      case 'matching':
        var pairs = response.split('#');
        response = pairs.join('[,]');
        var parts = response.split('.');
        return parts.join('[.]');
      case 'ikert':
      case 'numeric':
        // TODO this really should handle ranges, which is not
        // supported by SCORM (AFAIK)
      case 'other':
        return response;
      default:
        throw new Error('Inexpected response type: ' + type);
      }

      return response;
    },

    addCustomComposingFunction: function(eventSourceName, eventName, func) {
      func_name = Adapt.altxapi.getValidFunctionName(eventSourceName, eventName);
      this[func_name] = func;
    },

    setCustomVerbs: function() {
      // tcr stands for TinCan Registry: https://registry.tincanapi.com/
      this.xapiCustom.verbs['tcr_viewed'] = new ADL.XAPIStatement.Verb(
        "http://id.tincanapi.com/verb/viewed",
        {"en-US":"viewed"});
      this.xapiCustom.verbs['tcr_launched'] = new ADL.XAPIStatement.Verb(
        "http://adlnet.gov/expapi/verbs/launched",
        { "en-US": "launched" });
    },

    /*******************************************/
    /*****  Specific composing functions   *****/
    /*******************************************/

    getActivityBase: function() {
      return Adapt.altxapi._config._courseID;;
    },

    altxapi_course_initialized: function (statement, args) {
      // course started.
      statement.verb = ADL.verbs.initialized;
      statement.object = new ADL.XAPIStatement.Activity(this.getActivityBase());
    },

    altxapi_course_terminated: function (statement, args) {
      // course is being unloaded
      statement.verb = ADL.verbs.terminated;
      statement.object = new ADL.XAPIStatement.Activity(this.getActivityBase());
    },

    Adapt_router_menu: function (statement, args) {
      // visited menu
      statement.verb = this.xapiCustom.verbs.tcr_viewed;
      var objKey = Adapt.altxapi.getElementKey(args);
      //statement.object = new ADL.XAPIStatement.Activity(Adapt.altxapi._config._courseID + "#" + objKey);
      statement.object = new ADL.XAPIStatement.Activity(this.getActivityBase() + "#" + objKey);
      // TODO: at some point, parts of the statement should be configurable
      statement.object.definition = {type: this._ATB + 'menu', name: { 'en-US': 'menu' }};

    },

    Adapt_router_page: function (statement, args) {
      // visited page
      statement.verb = this.xapiCustom.verbs.tcr_viewed;
      var objKey = Adapt.altxapi.getElementKey(args);
      statement.object = new ADL.XAPIStatement.Activity(this.getActivityBase() + "#" + objKey);
      var t = args.get('_type');
      statement.object.definition = {type: this._ATB + t, name: { 'en-US': t }};
    },

    Adapt_questionView_recordInteraction: function(statement, args) {
      // answered question
      statement.verb = ADL.verbs.answered;
      var objKey = Adapt.altxapi.getElementKey(args.model);
      statement.object = new ADL.XAPIStatement.Activity(this.getActivityBase() + "#" + objKey);
      var t = args.model.get('_component');
      statement.object.definition = {type: this._ATB + t, name: { 'en-US': t }};

      var response = '';
      if (typeof args.getResponse === 'function' && typeof args.getResponseType === 'function') {
        response = this.getXAPIResponse(args);
      } else if (args.model.has('_userAnswer')) {
        response = args.model.get('_userAnswer');
      }

      var resultObj = {
        score: { raw: args.model.get('_score') },
        success: args.model.get('_isCorrect'),
        completion: true,
        response: response
      }
      statement.result = resultObj;
    },

    components_change__isComplete: function (statement, args) {
      // Don't track _isComplete === false
      if (!args.get('_isComplete')) {
        return false;
      }

      // completed interaction
      statement.verb = ADL.verbs.completed;
      var objKey = Adapt.altxapi.getElementKey(args);
      statement.object = new ADL.XAPIStatement.Activity(Adapt.altxapi._config._courseID + "#" + objKey);
      var t = args.get('_component');
      statement.object.definition = {type: this._ATB + t, name: { 'en-US': t }};
    },

    Adapt_assessments_complete: function (statement, args) {
      // completed assessment
      statement.verb = ADL.verbs.completed;
      statement.object = new ADL.XAPIStatement.Activity(Adapt.altxapi._config._courseID + "#" + args.id);
      var t = args.type;
      statement.object.definition = {type: this._ATB + t, name: { 'en-US': t }};
      var result = { score: { raw: args.score },
        success: args.isPass,
        completion: args.isComplete,
        response:  ''
      }
      statement.result = result;
     },

    contentObjects_change__isComplete: function (statement, args) {
      // completed contentObject
      statement.verb = ADL.verbs.completed;
      var objKey = Adapt.altxapi.getElementKey(args);
      statement.object = new ADL.XAPIStatement.Activity(Adapt.altxapi._config._courseID + "#" + objKey);
      var t = args.get('_type');
      statement.object.definition = {type: this._ATB + t, name: { 'en-US': t }};
    },

    course_change__isComplete: function (statement, args) {
      // completed course
      statement.verb = ADL.verbs.completed;
      var objKey = Adapt.altxapi.getElementKey(args);
      statement.object = new ADL.XAPIStatement.Activity(Adapt.altxapi._config._courseID + "#" + objKey);
      var t = args.get('_type');
      statement.object.definition = {type: this._ATB + t, name: { 'en-US': objKey }};
    }

  }, Backbone.Events);

  XapiMessageComposer.initialize();
  return (XapiMessageComposer);
});
