'use strict';

const {readFileSync, existsSync} = require('fs');
const path = require('path');
const {parser} = require('posthtml-parser');
const {match} = require('posthtml/lib/api');
const expressions = require('posthtml-expressions');
const findPathFromTag = require('./find-path');
const processLocals = require('./locals');
const processAttributes = require('./attributes');
const {processPushes, processStacks} = require('./stacks');
const {setFilledSlots, processSlotContent, processFillContent} = require('./slots');

// const {inspect} = require('util');
// const debug = true;
// const log = (object, what, method) => {
//   if (debug === true || method === debug) {
//     console.log(what, inspect(object, false, null, true));
//   }
// };

/* eslint-disable complexity */
module.exports = (options = {}) => tree => {
  options.root = path.resolve(options.root || './');
  options.folders = options.folders || [''];
  options.tagPrefix = options.tagPrefix || 'x-';
  options.tag = options.tag || false;
  options.attribute = options.attribute || 'src';
  options.namespaces = options.namespaces || [];
  options.namespaceSeparator = options.namespaceSeparator || '::';
  options.fileExtension = options.fileExtension || 'html';
  options.yield = options.yield || 'yield';
  options.slot = options.slot || 'slot';
  options.fill = options.fill || 'fill';
  options.slotSeparator = options.slotSeparator || ':';
  options.push = options.push || 'push';
  options.stack = options.stack || 'stack';
  options.localsAttr = options.localsAttr || 'props';
  options.expressions = options.expressions || {};
  options.plugins = options.plugins || [];
  options.attrsParserRules = options.attrsParserRules || {};
  options.strict = typeof options.strict === 'undefined' ? true : options.strict;

  if (!(options.slot instanceof RegExp)) {
    options.slot = new RegExp(`^${options.slot}${options.slotSeparator}`, 'i');
  }

  if (!(options.fill instanceof RegExp)) {
    options.fill = new RegExp(`^${options.fill}${options.slotSeparator}`, 'i');
  }

  if (!(options.tagPrefix instanceof RegExp)) {
    options.tagPrefix = new RegExp(`^${options.tagPrefix}`, 'i');
  }

  if (!Array.isArray(options.matcher)) {
    options.matcher = [];
    if (options.tagPrefix) {
      options.matcher.push({tag: options.tagPrefix});
    }

    if (options.tag) {
      options.matcher.push({tag: options.tag});
    }
  }

  options.folders = Array.isArray(options.folders) ? options.folders : [options.folders];
  options.namespaces = Array.isArray(options.namespaces) ? options.namespaces : [options.namespaces];
  options.namespaces.forEach((namespace, index) => {
    options.namespaces[index].root = path.resolve(namespace.root);
    if (namespace.fallback) {
      options.namespaces[index].fallback = path.resolve(namespace.fallback);
    }

    if (namespace.custom) {
      options.namespaces[index].custom = path.resolve(namespace.custom);
    }
  });

  options.locals = {...options.expressions.locals};
  options.aware = {};

  const pushedContent = {};

  return processStacks(
    processPushes(
      processTree(options)(
        expressions(options.expressions)(tree)
      ),
      pushedContent,
      options.push
    ),
    pushedContent,
    options.stack
  );
};
/* eslint-enable complexity */

/**
 * @param  {Object} options Plugin options
 * @return {Object} PostHTML tree
 */
function processTree(options) {
  const filledSlots = {};

  // let processCounter = 0;

  return function (tree) {
    if (options.plugins.length > 0) {
      tree = applyPluginsToTree(tree, options.plugins);
    }

    match.call(tree, options.matcher, currentNode => {
      if (!currentNode.attrs) {
        currentNode.attrs = {};
      }

      const componentFile = currentNode.attrs[options.attribute] || findPathFromTag(currentNode.tag, options);

      if (!componentFile) {
        return currentNode;
      }

      const componentPath = path.isAbsolute(componentFile) && !currentNode.attrs[options.attribute] ?
        componentFile :
        path.join(options.root, componentFile);

      // Check if file exist only when not using x-tag
      if (currentNode.attrs[options.attribute] && !existsSync(componentPath)) {
        if (options.strict) {
          throw new Error(`[components] The component was not found in ${componentPath}.`);
        } else {
          return currentNode;
        }
      }

      // console.log(`${++processCounter}) Processing component ${componentPath}`);

      let nextNode = parser(readFileSync(componentPath, 'utf8'));

      // Set filled slots
      setFilledSlots(currentNode, filledSlots, options);

      // Reset previous locals with passed global and keep aware locals
      options.expressions.locals = {...options.locals, ...options.aware};

      const {attributes, locals} = processLocals(currentNode, nextNode, filledSlots, options);

      options.expressions.locals = attributes;
      options.expressions.locals.$slots = filledSlots;
      // const plugins = [...options.plugins, expressions(options.expressions)];
      nextNode = expressions(options.expressions)(nextNode);

      if (options.plugins.length > 0) {
        nextNode = applyPluginsToTree(nextNode, options.plugins);
      }

      // Process <yield> tag
      const content = match.call(nextNode, {tag: options.yield}, nextNode => {
        // Fill <yield> with current node content or default <yield>
        return currentNode.content || nextNode.content;
      });

      // Process <fill> tags
      processFillContent(nextNode, filledSlots, options);

      // Process <slot> tags
      processSlotContent(nextNode, filledSlots, options);

      // Remove component tag and replace content with <yield>
      currentNode.tag = false;
      currentNode.content = content;

      processAttributes(currentNode, attributes, locals, options);

      // log(currentNode, 'currentNode', 'currentNode')
      // currentNode.attrs.counter = processCounter;
      // currentNode.attrs.data = JSON.stringify({ attributes, locals });

      // messages.push({
      //   type: 'dependency',
      //   file: componentPath,
      //   from: options.root
      // });

      return currentNode;
    });

    return tree;
  };
}

function applyPluginsToTree(tree, plugins) {
  return plugins.reduce((tree, plugin) => {
    tree = plugin(tree);
    return tree;
  }, tree);
}
