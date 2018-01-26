# adapt-alt-xAPI

An Adapt extension that implements xAPI tracking. It can send xAPI statements to an LRS, and save and load the state to/from the LRS.

It implements several launch methods, so you can use your Adapt course in different xAPI environments:

 - Tincan launch
 - ADL xapi-launch
 - Hardcoded (just for testing purposes, not to be used in a real xAPI enviroment).
 - Spoor (custom method to allow xAPI tracking from within SCORM packages, specific to Adapt with adapt-contrib-spoor)

This extension uses the xAPI Wrapper library provided by ADL.

The adapt-alt-xAPI extension is compatible with the Authoring Tool. I have tested that the plugin can be uploaded to the AT, and that the configuration settings are available. I don't use the Authoring Tool, so I haven't tested a course built with it using this extension, but it should be ok (I've tested using the framework).

# Background

This extension is an evolution/rewrite of adapt-tkhub-xAPI (another xAPI extension that relied on adapt-trackingHub).

This version is much simpler to use. It is a _stand-alone_ extension and has less configuration settings to worry about.

For more background information about why this new version was developed please [see this blog post]( https://www.acutilis.com/blog/new-xapi-plugin-for-adapt/).

## Installation

Important: This extension requires version v2.0.16 of the Adapt Framework. It will **not** work with earlier versions.

With the Adapt CLI installed, run the following from the command line:

`adapt install adapt-alt-xapi`

To use it with the Authoring Tool, here in the github repository page click on 'Clone or download' and then click on the 'Download ZIP'. Upload that zip file to the Authoring Tool using the Plugin Manager. Within your course, click on 'Manage Extensions' and click on the green 'Add' button that appears to the right of adapt-alt-xAPI. Then open the 'Configuration Settings' for your course, and find the 'Extensions' section, click on the **AltxAPI** button and configure it.

## Settings

If you  are using the framework, get the settings for `_altxapi` from the example.json file and place them into your course/config.json.

These are the descriptions of the settings:

- `_isEnabled`: True or false (defaults to true). To enable or disable this extension in your course.
- `_courseID`: A _unique_ id for your course. It must be a URI. In the  Authoring Tool, the format of this setting has been constrained to be URL, since it is a very convenient method of constructing a unique ID.
- `_localLoggingOnly`: True or false (defaults to false). If you want to test the extension without really sending statements to the LRS, set this to `true`. The statements will just be shown on the browser console.
- `_identifyById`: For tracking, it is necessary to identify components uniquely, and that _identification_ should be mostly permanent. The `_id` attribute is unique, but -at least in the Authoring Tool- is not permanent (the AT generates new IDs every time you publish), so it's not such a good property to use. If `_identifyById` is set to `true`, adapt-alt-xAPI will be forced to use the `_id` property to identify components. If set to false (the default), it will use the `title` attribute. This has one **important consequence**: all components must have a title, and the title must be unique in the course. The Authoring Tool requires the title, but it does not check for uniqueness. If you use the Framework directly, the course will be built even if components are missing the `title`. So, if `_identifyById` is false, which it should, adapt-alt-xAPI will check the `title` attributes of all components, and alert you if any one is missing or there are duplicates.
- `_saveLoadState`: True or false (defaults to true). If set to false, the state will not be saved to (or loaded from) the LRS. Useful for testing communication with the LRS without polluting the _state_ for the user.
- `_ignoreEvents`: An array of strings which are the event names that we want to ignore.
- `_launchMethod`: The launch method to use. It depends on how you plan to deploy your Adapt course. It has to be one of `hardcoded`, `tincan`, `adlxapi`, or `spoor`. Depending on which launch method is used, you will need to supply info in some of the other settings. Please see below for more information on the different [Launch Methods](#Launch-Methods).
- `_endPoint`: It is the endPoint for the LRS that you want to use. You will find this information in your LRS. You only need to specify this setting if you are using 'hardcoded' or 'spoor' launch methods.
- `_userName`: The username for basic authentication in the LRS. You will find this information in your LRS (be aware that some LRSs use the term _key_ or _user key_ instead of _username_). You only need to specfy this setting if you are using the 'harcoded' or 'spoor' launch methods.
- `_password`: The password for basic authentication in the LRS.  You will find this information in your LRS (some LRSs call this _secret_ instead of _password_). You only need to specfy this setting if you are using the 'harcoded' or 'spoor' launch methods.
- `_mbox`: A string. It can be anything you want, as long as its format is like "mailto:johndoe@example.com". You only need to specify this setting if you are using the 'hardcoded' launch method.
- `_fullName`: A string. It can be anything you want, just a person's name. You only need to specify this setting if you are using the 'hardcoded' launch method.
- `_homePage`: The URL of a system (usually an LMS). It is only used used as an _identifier_. You only need to specify this setting if you are using the 'spoor' launch method.

As you can see, some settings are specific to some launch methods. However, there is no harm if you set them all in the configuration. The extension will only use the ones it needs, depending on the launch method selected.


## Launch methods

When an Adapt course that uses the adapt-alt-xAPI extension is started, fairly early in the process it performs the _launch sequence_, whose purpose is to obtain the identity of the user, and possibly other information needed so that tracking works properly. In xAPI the _launch sequence_ is **vital**: the content needs to have some identity for the user who is using the content (so it can build the `actor` property of the statement), and **where** to send the statement (LRS endpoint and credentials). Without that, there is no xAPI tracking.

When thinking about tracking from a SCORM background, sometimes we forget that the SCO also needs all this information, but it is there in a very _transparent_ way, so to speak. When a SCO 'realizes' that it has been launched, it can easily find the API that provides a connection to the LMS, where the user is perfectly identified (because she is logged in), and the SCO can even retrieve info about the user, if it wants to say 'Hi, John. Welcome to this course'. 

In xAPI, the content is totally independent from the LRS. An LRS **never** launches content.  An Adapt course that will act as a source of xAPI statements needs that information too: the 'user identity' and 'a way to connect' to the LRS. In an xAPI environment, that information can be provided through the _launch mechanism_. So any xAPI extension for Adapt should be able to handle one or more launch mechanisms or _methods_.

Most authoring tools only use **one** launch method: the most widely known, 'tincan', in which the data is passed to the content through the query string in the URL. And they don't provide usually any detailed info about how exactly it's implemented (which extra parameters it accepts, if any). This can be limiting.

Since Adapt is Open Source, and so is this extension, the _launch method_ is clearly exposed and implemented. If you need a different launch method, just fork this extension and implement your custom launch method.

adapt-alt-xAPI implements four launch methods, two of which are widely known, and two of which are specific to Adapt, and mostly for convenience.

As explained earlier, the setting `_launchMethod` in the configuration determines what launch method the course will respond to. Please note that the launch method depends on your specific set up, on how the course is going to be launched. Then, you set up your course to operate under the assumption that it is going to be launched with that specific method.


### Tincan

This launch method implements the launch mechanism proposed by Rustici [tincan launch](https://github.com/RusticiSoftware/launch/blob/master/lms_lrs.md).

It has been tested in Moodle 3.1 with Andrew Downe's (@garemoko) [plugin for Moodle](https://github.com/garemoko/moodle-mod_tincanlaunch). This makes it possible to launch Adapt courses from Moodle, and to send the statments to an LRS.
It can also be used/tested manually, creating a properly formatted launch URL.

In this method, the information about the actor, the LRS enpoint, and credentials is passed on the query string of the url. 

This is the most widely known launch method, although it has some privacy/security downsides.


### ADL xapi-launch

This launch method (`adlxapi`) will make the Adapt course respond to the ADL xapi-launch method described [here](https://github.com/adlnet/xapi-launch). 

It has been tested with the sample server they provide in that same repository.

This is quite an interesting method, and more _secure_ than the others, because it does not expose the credentials of the LRS. However, it requiers a server side application (ADL provides one in that repository). The algorithm is explained in their documentation.

The ADL xapiWrapper library (from ADL) that adapt-alt-xAPI uses, actually implements this method. How convenient!. Thanks to that, the corresponding launch function has to do very little: just call the function provided by the xapiWrapper (`ADL.launch`) and get the data in the callback we provide.

With this method, the xapi-launch server creates a proxy endpoint where the course sends the xAPI statments. That proxy sends the statement to the LRS that you have configured previously.

**NOTE**: The ADL launch server actually signs the statements before forwarding them to the LRS. When testing on version 1 of Learning Locker, the statements reached the LRS. Using version 2 of Learning Locker I have observed that Learning Locker rejects the statements because the signature does not pass the verification phase. However, the signed statements are accepted by the ADL LRS server (reference implementation available at [https://lrs.adlnet.gov/](https://lrs.adlnet.gov/). Testing with more LRSs is needed to determine where the error is (whether in the signing code of ADL launch server, or in LL v2 signature verification).


### Hardcoded
This not a launch method that you would use in real life, it is only intended for testing and development.

With this method, you specify the user identity, the LRS endpoint, and the LRS credentials directly in the configuration of the course. The launch sequence will just read these values from the config, and use them.

As mentioned, this cannot be used in real life, because you can't embed the identity of the user in the content itself. But this is convenient during development/testing. It's an easy way to ensure that you have no other problems (network, dns, etc.) reaching your LRS.

### Spoor

This is a non-standard mechanism that allows you to do xAPI tracking in an Adapt course that was deployed as a SCORM package. It is just a convenienece method that will allow you to experiment with xAPI if you can't (or don't want to) use the 'tincan' launch method or any other method.

**IMPORTANT**: Please do not misinterpret the function of this launch method. It will NOT magically make your Adapt course report completions and transform SCORM behavior into xAPI behavior. SCORM is SCORM, and xAPI is another thing. And this extension keeps them separate. This launch method will be useful to you if you want to experiment with xAPI, but your LMS does not have the capability of launching xAPI content. Since your LMS **is able** to handle SCORM packages, you can use this 'trick method' to use SCORM packages that just happen to send xAPI statements to an LRS. You still need a separate LRS, and you will need to embed the LRS info (endpoint and credentials) in the configuration file of the content, which is not ideal, but hey!, this is just a trick/convenience method.

If one thinks about xAPI in an LMS environment, the way to go is CMI5. To be able to use CMI5, both the LMS and the content must conform to the CMI5 specification. Unfortunately, adapt-alt-xAPI does not implement CMI5 at this point. So, this this artificial `spoor` launch method allows SCOs to send statements to an LRS.

To use this, you would package your course for SCORM, using Spoor, as usual. The content is going to be uploaded to an LMS, and launched from the LMS. Once the Adapt course is launched, the `launch_spoor` function in `adapt-alt-xapi.js` will get the user id with this call:

```
 var studentID = pipwerks.SCORM.data.get("cmi.core.student_id"); 
```
One of the valid Inverse Functional Identifiers in xAPI is an `account Object`, which has two properties, `homePage`, and `name`. The name is the id that we just got through the SCORM API, and the `homePage` is an IRL that we must specify in the configuration of the course.

As you can see this _launch method_ constructs the user identity in an _artificial_ way: getting part of it from the LMS, and using a pre-configured value to complete it. Obviously, this will only be useful if that way of identifying users is acceptable in your situation.

Again, LMS + xAPI should make us think about CMI5, but, in the mean time, if somemody needs to send xAPI statements from within a SCORM Adapt course, it is possible.

This illustrates that one can write custom launch methods to fit specific situations.

## What is tracked

### Events
This extension, by default, tracks the events defined at the beginning of the main code(in `adapt-alt-xapi.js`):

```
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

```
When each of those events happen, this extension creates an xAPI statement with all the relevant information, and sends it to the LRS.


### State

This extension can save the state of the user in the course, and load it upon launch.

The state representation used by this extension is pretty straightforward: it consists of various attributes of all the elements in the Adapt course (content objects, articles, blocks, and components). You can see how this representation is built in the function `updateState`.

This state representation is not particularly efficient, but it is very complete, and works. There have been some improvements in Adapt regarding state representation for use with xAPi, but they have not been released yet. When a future version of the Adapt framework is released (incorporating these improvements) it will be easier to update this extension to do more efficient state handling.


### How statements are constructed

The code that builds the statements is placed in a separate file, `xapiMessageComposer.js`, for clarity.

This code makes use of the [xapiWrapper library](https://github.com/adlnet/xAPIWrapper) provided by ADL. This library provides tons of lower level functionality that we are going to need anyway.

Please note that how each statement is constructed depends on the corresponding event. The _specific composing functions_ are named according to the event they _represent_, and depending on what event that is, the statement will include some contextual information, etc.

The _object_ of all statements is built combining the 'base activity' (which is either the `_courseID` specified on the configuration, or the activity id passed during the launch) and an identifier for the particular course element that the event is about. This identifier will normally be the `title` of the content object (page), or component, but it could instead be the `_id` (which one to use is controlled by the `_identifyById` setting in the config file).

For example, if the `_courseID` is "http://www.acme.com/courses/4f4f4f"

Any statement that refers to the course itself, will have the following object:

```
"object": {
      "id": "http://www.acme.com/courses/4f4f4f",
      "objectType": "Activity"
},
```

A statement that refers to a menu page whose title is "adapt_version_2_0_demonstration" will have the following object:

```
 "object": {
      "definition": {
        "name": {
          "en-US": "menu"
        },
        "type": "http://adaptlearning.org/xapi/activities/menu"
      },
      "id": "http://www.acme.com/courses/4f4f4f#adapt_version_2_0_demonstration",
      "objectType": "Activity"
    },
```

A statement that refers to a content page whose title is "presentation_components" will have the following object:

```
"object": {
      "definition": {
        "name": {
          "en-US": "page"
        },
        "type": "http://adaptlearning.org/xapi/activities/page"
      },
      "id": "http://www.acme.com/courses/4f4f4f#presentation_components",
      "objectType": "Activity"
    },
```

A statement that refers to a component (narrative) whose title is "characteristicsOfMamals" will have the following object:

```
"object": {
      "definition": {
        "name": {
          "en-US": "narrative"
        },
        "type": "http://adaptlearning.org/xapi/activities/narrative"
      },
      "id": "http://www.acme.com/courses/4f4f4f#characteristicsOfMamals",
      "objectType": "Activity"
    },
```
and so forth.

As you can see, the `id` of the statement object uniquely identifies the Adapt object within the course. This is why it is recommended to use titles (`_identifyById` set to `false` in the configuration file) and why the titles have to be unique within the course. This will make it easier to identify things in later analyisis of the LRS data.

Also note that the URI for the type of the object is a made-up URI that identifies the different types of components/objects etc. particularly in the realm of Adapt.


The statements that this extension sends are:

- when the Adapt course is started (verb: 'initialized', object: the course)
- when the Adapt course is unloaded (tab or window is closed, or user navigates away) (verb: 'terminated', object: the course)
- when the user goes to a menu page (verb: 'viewed', object: the menu page)
- when the user goes to a content page (verb 'viewed', object: the page title)
- when Adapt sets a component as _complete_ (verb 'completed', object: the component)
- when Adapt sets a page as _complete_ (verb 'completed', object: the page)
- when Adapt sets the course as _complete_ (verb 'completed', object: the course)
- when a question is completed (verb 'completed', object: the question component).
- when a question is answered (verb 'answered', object: the question component). Additional information is included in the `result` of the statement.
- when Adapt sets an assessment as complete (verb 'completed', object: the assessment). Additional information is included in the `result` of the statement.


All these defaults provide fairly detailed information about the user's journey through the adapt content. If any of these don't work for you, it's easy to fork this extension and modify it to fit your needs.


## Packaging for LMS upload

Since an Adapt course is really a static web site, it can be hosted on any web server. This is also true if the course is xAPI-enabled with adapt-alt-xapi, as long as an appropriate launch  mechanism is used (in this case, it could be the 'tincan' on the 'adlxapi' methods).

However, an Adapt course with adapt-alt-xapi can be packaged to be uploaded to an LMS if the LMS can handle 'tincan packages'. For example, the [Moodle plugin mentioned earlier](https://github.com/garemoko/moodle-mod_tincanlaunch), adds the capability to handle tincan packages in Moodle. This way, you can upload a zip file with xAPI-enabled contents to Moodle, and it will host the content and launch them using the 'tincan' method.

To package an Adapt course this way, you have to add a file named `tincan.xml` to the root of your `build` folder, then zip the contents of the `build` folder and upload it to Moodle (defining an activity of type 'tincan launch link'.

The contents of your `tincan.xml` must be like this:

```
<?xml version="1.0" encoding="utf-8" ?>
<tincan xmlns="http://projecttincan.com/tincan.xsd">
    <activities>
        <activity id="http://www.acme.com/courses/4f4f4f" type="http://adlnet.gov/expapi/activities/course">
            <name>Course title</name>
            <description lang="en-US">Course description</description>
            <launch lang="en-US">index.html</launch>
        </activity>
    </activities>
</tincan>
```

Please **be sure** to change the activity id, the name, and the description to fit your needs.

For more information on 'tincan packaging' please [see this document](https://github.com/RusticiSoftware/launch/blob/master/lms_lrs.md).
