/**
 * @file RequestContructor
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project Pomegranate-request
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

'use strict';
var PluginUtils = require('magnum-plugin-utils')

var FileList = PluginUtils.fileList;
var FileBaseName = PluginUtils.fileBaseName;
var _ = PluginUtils.lodash
var Promise = PluginUtils.bluebird
var path = require('path');

/**
 *
 * @module RequestContructor
 */

exports.options = {
  workDir: './endpoints'
}

exports.metadata = {
  name: 'Endpoints',
  type: 'dynamic',
  depends: ['Request']
}

exports.plugin = {
  load: function(inject, loaded) {
    var self = this;
    var workDir = this.options.workDir

    var ReqBuilder = inject('Request')
    var Envs = inject('Env')


    function parseEndpoint(param,endpointarr){

      if(!_.isString(param) || !_.isArray(endpointarr)) {
        self.Logger.error('Param or return value is undefined.')
        return false
      }
      //Normalize
      var endpoint = _.isString(endpointarr[0]) ? endpointarr[0] : false
      var args = (function(optionalArgs){
        if(optionalArgs){
          if(_.isObject(optionalArgs)){
            return optionalArgs
          }
          self.Logger.error('Options argument "' + endpointarr[1] + '" in the 2rd array index must be an object.')
          self.Logger.error('Loading of this plugin will fail until the config issue is resolved.')
          return false
        }
        return {}

      })(endpointarr[1])

      //Bail early if we are missing args
      if(!endpoint || !args){
        self.Logger.error('Missing required arguments, plugin loading will fail.')
        return false
      }

      //Actual config object.
      _.merge(args, {baseUrl: endpoint})

      //For logging, but bail on error because we have problems if that object can't be stringified.
      try {
        var strung = JSON.stringify(args, null, 2)
      }
      catch(e){
        self.Logger.warn('Could not stringify arguments.')
        return false
      }

      self.Logger.log( param + ' Param - using config object ' + strung)

      return {param: param, load: ReqBuilder(args)}
    }



    FileList(workDir)
      .then(function(files) {
        return Promise.map(files, function(file){

          var pending = require(path.join(workDir, file))

          var injectParam = FileBaseName(file)

          // Deep overloading here.
          // If we have an array returned from out require call,
          // attempt to use it directly.
          if(_.isArray(pending)){
            return parseEndpoint(injectParam, pending)
          }

          // If its a function run it and inspect the results for a thenable.
          if(_.isFunction(pending)){
            var maybePromise = pending(ReqBuilder(), Envs)

            // If it is thenable resolve it and use the result.
            if(_.isFunction(maybePromise.then)){
              return maybePromise.then(function(pending){
                return parseEndpoint(injectParam, pending)
              })
            }

            // Not thenable? Use the return directly.
            return parseEndpoint(injectParam, maybePromise)

          }

        })

      })
      .then(function(results) {

        if(!_.every(results)){
          return loaded(new Error('Could not construct the Request objects, please check the plugin files.'))
        }

        loaded(null, results)
      })
  },
  start: function(done) {
    done()
  },
  stop: function(done) {
    done()
  }
}
