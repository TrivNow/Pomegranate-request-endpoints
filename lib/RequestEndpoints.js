/**
 * @file RequestContructor
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project Pomegranate-request
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

'use strict';
// let PluginUtils = require('magnum-plugin-utils')

let _ = require('lodash')
let Promise = require('bluebird')

/**
 *
 * @module RequestContructor
 */

exports.options = {
  workDir: './endpoints'
}

exports.metadata = {
  frameworkVersion: 6,
  name: 'Endpoints',
  type: 'dynamic',
  depends: ['Request']
}

exports.plugin = {
  load: function(Logger,Options, Request, Envs, PluginFiles) {

    let workDir = Options.workDir

    let ReqBuilder = Request


    function parseEndpoint(param,endpointarr){

      if(!_.isString(param) || !_.isArray(endpointarr)) {
        Logger.error('Param or return value is undefined.')
        return false
      }
      //Normalize
      let endpoint = _.isString(endpointarr[0]) ? endpointarr[0] : false
      let args = (function(optionalArgs){
        if(optionalArgs){
          if(_.isObject(optionalArgs)){
            return optionalArgs
          }
          Logger.error('Options argument "' + endpointarr[1] + '" in the 2rd array index must be an object.')
          Logger.error('Loading of this plugin will fail until the config issue is resolved.')
          return false
        }
        return {}

      })(endpointarr[1])

      //Bail early if we are missing args
      if(!endpoint || !args){
        Logger.error('Missing required arguments, plugin loading will fail.')
        return false
      }

      //Actual config object.
      _.merge(args, {baseUrl: endpoint})


      Logger.log( param + ' -- base url is ' + args.baseUrl)

      return {param: param, load: ReqBuilder(args)}
    }



    return PluginFiles.fileList()
      .then(function(files) {
        return Promise.map(files, function(file){

          let pending = require(file.path)

          let injectParam = file.getBaseName()

          // Deep overloading here.
          // If we have an array returned from out require call,
          // attempt to use it directly.
          if(_.isArray(pending)){
            return parseEndpoint(injectParam, pending)
          }

          // If its a function run it and inspect the results for a thenable.
          if(_.isFunction(pending)){
            let maybePromise = pending(ReqBuilder(), Envs)

            // If it is thenable resolve it and use the result.
            if(maybePromise && _.isFunction(maybePromise.then)){
              return maybePromise
                .then(function(pending){
                  return parseEndpoint(injectParam, pending)
                })
                .catch(function(err){
                  Logger.error(err.message);
                  return false
                })
            }

            // Not thenable? Use the return directly.
            return parseEndpoint(injectParam, maybePromise)

          }

        })

      })
      .then(function(results) {
        if(!_.every(results)){
          throw new Error('Could not construct the Request objects, please check the plugin files.')
        }

        return results
      })
  }
}
