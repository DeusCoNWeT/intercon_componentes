/*
 * (C) Copyright 2018 Universidad Politécnica de Madrid.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Contributors:
 *     Miguel Ortega Moreno
 */


(function (window, document) {

  // Init
  var body = document.querySelector('html');
  var Polymer = window.Polymer;
  var mutation_conf = { childList: true, subtree: true };

  /**
   * @class ElementMap 
   * @classdesc Class to create a binding class of a HTMLElement 
   * @param {HTMLElement} element Element that will be mapped
   * @property {Object} properties Properties of the HTMLElement. Include inherit properties
   * @property {Object} consumers_prop Data consuming properties
   * @property {Object} producers_prop Data producing properties
   * @property {HTMLElement} model HTMLElement provided by Polymer
   * @property {Array} observers List of function that be called when an property changes
  */
  var ElementMap = function (element) {

    this.element = element;

    this.properties = Interconnection.getBindingProperties(element);

    this.consumers_prop = this.properties.__consumers;

    this.producers_prop = this.properties.__producers;

    this.model = Polymer.telemetry.registrations.find(function (el) { return el.is == element.tagName.toLowerCase(); });

    this.observers = {};
    this.listeners = {};

    delete this.properties.__consumers;
    delete this.properties.__producers;
  };

  /**
     *
     * @param {Function} fn Function that is called when the property change
     * @param {String} prop Property to be observerd
     * @param {HTMLElement}
     */
  ElementMap.prototype.createObserver = function (prop, target_el, target_prop, fn) {
    // TODO: evitar duplicados (?)
    // TODO: evitar bucles
    this.observers[prop] = this.observers[prop] || [];

    var observer = {
      fn: fn,
      target_el: target_el,
      target_prop: target_prop
    };
    this.observers[prop].push(observer);
  };

  /**
   * 
   * @param {HTMLElement} source_element Element from which data is to be consumed
   * @param {String} source_property Property of the element form which data is to be consumed
   * @param {String} target_prop Property where data will be written when the source property changes
   * @param {Function} fn Function that is called when the source property changes
   */
  ElementMap.prototype.createListener = function (source_element, source_property, target_prop, fn) {
    // TODO:  evitar duplicados (?)
    // TODO: evitar bucles

    var listener = {
      source_el: source_element,
      source_prop: source_property,
      target_prop: target_prop,
      fn: fn
    };

    // REVIEW: Solo se permite que una variable consuma datos de una fuente.
    // ¿Permitir N a N? Cambiar el modelo por una lista en ese caso. 
    // Empeora el problema de busqueda      
    if (this.listeners[target_prop]) {
      throw new Error('Property ' + target_prop + ' is already connected');
    }

    this.listeners[target_prop] = listener;
  };



  /**
   * Interconnection module
   * @exports Interconnection
   *
   */
  var Interconnection = {
    /**
     * Register of custom effects used to interconnect elements. There is only one effect for each registered custom element
     */
    __customEffects: {},
    elementsMap: new WeakMap(),
    /**
     * Dom observer to record when adding or deleting items
     */
    __domObserver: null,

    /**
     * Register a custom element in the binding map
     * @param {HTMLElement} element Element that is registered in the binding map
     */
    _registerElement: function (element) {
      // REVIEW: should throw an error instance of avoid it?
      if (!this.elementsMap.has(element)) {
        this.elementsMap.set(element, new ElementMap(element));
      }
    },
    /**
     * Remove a listener of a custom element registered in the binding map
     * @param {HTMLElement} element Element that will be unregistered
     */
    _unregisterElement: function (element) {
      if (this.elementsMap.has(element)) {
        this.unbindElement(element);
        this.elementsMap.delete(element);
      }
    },
    /**
     * Get all custom elements registered in the dom
     * @return {Array} Node list of custom elements in the dom
     */
    getCustomElements: function () {
      if (window.Polymer === undefined) {
        throw new Error('Polymer is not defined');
      } else {
        if (window.Polymer.telemetry) {
          var ce_registered = window.Polymer.telemetry.registrations.map(function (el) {
            return el.is;
          }) || [];

          return document.querySelectorAll(ce_registered.join(','));
        }
      }
    },

    /**
     * Register an model property of a custom element in order to notify each time it changes
     * @param {HTMLElement} model Custom element model provided by polymer
     * @param {String} path Model path property that is listened to each time it changes
     */
    _createEffect: function (model, path) {
      var name = model.is;
      this.__customEffects[name] = this.__customEffects[name] || {};

      var props = model._getPathParts(path);
      var base_prop = props[0];

      if (this.__customEffects[name][base_prop] == undefined) {
        var fx = Polymer.Bind.ensurePropertyEffects(model, base_prop);

        var propEffect = {
          kind: 'binding',
          fn: Interconnection._notifyObservers,
          pathFn: Interconnection._notifyObservers
        };

        fx.push(propEffect);
        this.__customEffects[name][path] = propEffect;
      }
    },
    /**
     * Get all properties of a custom element including inherited properties
     * @param {HTMLElement} element Custom element from which the properties are to be obtained
     * @return {Object} All element properties
     */
    getElementProperties: function (element) {
      if (typeof element === 'string') {
        try {
          element = document.querySelector(element);
        } catch (err) {
          throw new Error('Element does not exist');
        }
      }
      var properties = {};

      // Inheritance properties
      if (element.behaviors) {
        element.behaviors.forEach(function (behaviour) {
          if (behaviour.properties) {
            Object.assign(properties, behaviour.properties);
          }
        });
      }

      // own properties
      Object.assign(properties, element.properties);
      return properties;
    },

    /**
     * Check if an element is a custom element
     * @param {HTMLElement} element Element to be checked
     * @return {Boolean} If it is a custom element or
     */
    isCustomelement: function (element) {
      return element instanceof HTMLElement && element.is !== undefined;
    },
    /**
     * Take all the properties of an element differentiating between consuming and producing properties.
     * A property is consumer and producer unless readOnly is set to true
     * @param {HTMLElement} element Custom element from which the properties are to be obtained
     * @return {Object} Object with all the properties of the element and the __cosumers 
     * and __producers variables that include each of the properties that consume and produce
     * data respectively.
     */
    getBindingProperties: function (el) {
      var properties = Interconnection.getElementProperties(el);
      var bindingProperties = {
        __consumers: {},
        __producers: {}
      };

      for (var prop_name in properties) {
        if (properties.hasOwnProperty(prop_name)) {
          var prop_value = properties[prop_name];
          prop_value.producer = true;

          // set as consumer
          if (!properties.readOnly && !properties.computed) {
            prop_value.consumer = true;
            bindingProperties.__consumers[prop_name] = prop_value;
          }
          bindingProperties.__producers[prop_name] = prop_value;
          bindingProperties[prop_name] = prop_value;
        }
      }
      return bindingProperties;
    },

    /**
     * Connect source property to target property properties of two elements. Source property will write data on consumer property
     * 
     * @param {HTMLElement} el_source Element that will produce the data
     * @param {String} prop_source Property that will produce the data
     * @param {HTMLElement} el_target Element that will consume the data
     * @param {String} prop_target Property that will consume the data
     */

    bind: function (source_el, source_prop, target_el, target_prop) {
      if (!(source_el instanceof HTMLElement) || !(target_el instanceof HTMLElement)) {
        throw new Error('Source and target element must be a HTMLElement');
      }

      if (source_el == target_el) {
        throw new Error('Cannot bind the same element');
      }

      var source_map = Interconnection.elementsMap.get(source_el);
      var target_map = Interconnection.elementsMap.get(target_el);

      if (!this.isCustomelement(source_map) && !this.isCustomelement(target_el)) {
        throw new Error('Both element must be custom elements');
      }

      //REVIEW: Should be a map created if it doesnt exist?
      if (!source_map) {
        this._registerElement(source_el);
        source_map = Interconnection.elementsMap.get(source_el);
      }
      if (!target_map) {
        this._registerElement(target_el);
        target_map = Interconnection.elementsMap.get(target_el);
      }

      // if path bind
      var source_prop_base = Polymer.Path.root(source_prop);
      var target_prop_base = Polymer.Path.root(target_prop);


      if (!source_map.producers_prop[source_prop_base]) {
        throw Error('Property "' + source_prop_base + '" is not a producer property');
      }

      if (!target_map.producers_prop[target_prop_base]) {
        throw Error('Property "' + target_prop_base + '" is not a producer property');
      }

      var fn = function (source, value, effect, old, fromAbove, dirtyCheck) {
        // translate the path notification to new path
        var notify_path = Polymer.Path.translate(source_prop, target_prop, source);
        // If dirty check is true, do it https://www.polymer-project.org/1.0/docs/devguide/model-data#override-dirty-check
        if (dirtyCheck) {
          target_el.set(target_prop, null);
        }
        target_el.set(target_prop, value);

        target_el.notifyPath(notify_path);
      };

      target_map.createListener(source_el, source_prop, target_prop, fn);
      source_map.createObserver(source_prop, target_el, target_prop, fn);
      this._createEffect(source_map.model, source_prop);

      // initialization
      fn(source_prop, source_el.get(source_prop), null, null, null, true);
    },

    /**
     * Function to notify to all observer that a property of an element has changed
     * @param {String} source Property that produce the change
     * @param {Any} value New value of the property
     * @param {Any} effect Effect defined for this type of notification (currently unused) 
     * @param {Any} old Last value of the property
     * @param {Any} fromAbove Provided by Polymer (currently unused)
     */
    _notifyObservers: function (source, value, effect, old, fromAbove) {
      var el_map = Interconnection.elementsMap.get(this);
      var observers = el_map.observers[source];
      var parts = this._getPathParts(source);

      if (observers) {
        observers.forEach(function (observer) { observer.fn(source, value, effect, old, fromAbove); });
      }
      // Notify above
      if (parts.length > 1) {
        Interconnection._notifyAbove.call(this, source, value, effect, old, fromAbove);
      }
    },
    /**
     * Notify parents of changes in an object. Changes in `test.mytest` will be notified to `test`.
     * In the same way, changes in `test.mytest.myvar` will be notified to `test` and `test.mytest`
     * @param {String} source Path of the change source
     * @param {Any} value Value of the change
     * @param {Any} effect Effect defined for this type of notification (currently unused) 
     * @param {Any} old Last value of the property
     * @param {Any} fromAbove Provided by Polymer (currently unused)
     */
    _notifyAbove: function (source, value, effect, old, fromAbove) {
      var observers, new_val, path;
      var parts = this._getPathParts(source);
      parts.pop();

      var el_map = Interconnection.elementsMap.get(this);

      // Notify all parents
      while (parts.length > 0) {
        path = parts.join('.');
        observers = el_map.observers[path];
        new_val = this.get(path);
        if (observers) {
          observers.forEach(function (observer) { observer.fn(source, new_val, effect, old, fromAbove); });
        }
        parts.pop();
      }
    },
    /**
     * Check if any custom element property is consuming or producing data.
     * @param {HTMLElement} element Element that will be checked
     * @return {Boolean} If the custom element is consuming or producing data
     */
    isBinded: function (element) {
      var isBinded = false;

      if (this.elementsMap.has(element)) {
        var map = this.elementsMap.get(element);

        if (Object.keys(map.observers).length > 0) {
          for (var prop in map.observers) {
            isBinded = isBinded || map.observers[prop].length > 0;
          }
        }
        if (Object.keys(map.listeners).length > 0) {
          for (var prop in map.listeners) {
            isBinded = isBinded || map.listeners[prop] != {};
          }
        }
      }

      return isBinded;
    },
    /**
     * Check if a custom element property is consuming or producing data.
     * @param {HTMLElement} element Element that will be checked
     * @param {String} property Property that will be checked
     * @return {Boolean} If a custom element property is consuming or producing data
     */
    isPropertyBinded: function (element, property) {
      var isBinded = false;

      if (this.elementsMap.has(element)) {
        isBinded = this.isConsumer(element, property) || this.isProducer(element, property);
      }

      return isBinded;
    },

    /**
     * Check if a custom element property is consuming data.
     * @param {HTMLElement} element Element that will be checked
     * @param {String} property Property that will be checked
     * @return {Boolean} If a custom element property is consuming data
     */
    isConsumer: function (element, property) {

      return this.elementsMap.has(element) && this.elementsMap.get(element).listeners[property] !== undefined;
    },

    /**
     * Check if a custom element property is producing data.
     * @param {HTMLElement} element Element that will be checked
     * @param {String} property Property that will be checked
     * @return {Boolean} If a custom element property is producing data
     */
    isProducer: function (element, property) {
      var map = this.elementsMap.get(element);
      return map !== undefined && map.observers[property] !== undefined && map.observers[property].length > 0;
    },

    /**
     * Unbind a property of a custom element of consuming data
     * @param {HTMLElement} target_el Consumer element
     * @param {String} target_prop Consumer property
     */
    unbindConsumer: function (target_el, target_prop) {

      if (!(target_el instanceof HTMLElement)) {
        throw new Error('Target element is not an HTMLElement');
      }

      var el_map = this.elementsMap.get(target_el);
      if (!el_map) {
        throw new Error('Target element is not a custom element');
      }

      var listener = el_map.listeners[target_prop];
      if (listener) {
        delete el_map.listeners[target_prop];

        var source_map = this.elementsMap.get(listener.source_el);
        var idx = source_map.observers[listener.source_prop].indexOf(listener.fn);

        source_map.observers[listener.source_prop].splice(idx, 1);

      }
    },
    /**
     * Unbind a property of a custom element of producing data
     * @param {HTMLElement} target_el Producer element
     * @param {String} target_prop Producer property
     */
    unbindProducer: function (target_el, target_prop) {

      if (!(target_el instanceof HTMLElement)) {
        throw new Error('Target element is not an HTMLElement');
      }

      var el_map = this.elementsMap.get(target_el);
      if (!el_map) {
        throw new Error('Target element is not a custom element');
      }

      var observers = el_map.observers[target_prop];
      el_map.observers[target_prop] = [];

      var that = this;
      if (observers) {
        observers.forEach(function (observer) {
          delete that.elementsMap.get(observer.target_el).listeners[observer.target_prop];
        });
      }
    },

    /**
     * Unbind a custom element property of consuming and producing data
     * @param {HTMLElement} target_el Element that will be unbinded
     * @param {String} property Property that will be unbinded
     */
    unbind: function (target_el, target_prop) {
      this.unbindConsumer(target_el, target_prop);
      this.unbindProducer(target_el, target_prop);
    },
    /**
     * Unbind all connections of a custom element properties.
     * Eliminates all production and consumer connections
     * @param {HTMLElement} element Element that will be unbinded
     */
    unbindElement: function (element) {
      var map = this.elementsMap.get(element);

      for (var property in map.observers) {
        this.unbindProducer(element, property);
      }

      for (var property in map.listeners) {
        this.unbindConsumer(element, property);
      }
    }
  };

  window.Interconnection = Interconnection;

  var load_dom = function () {
    Polymer = window.Polymer;
    Interconnection.__domObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        // NodeList.forEach issues
        [].forEach.call(mutation.addedNodes, function (added) {
          if (Interconnection.isCustomelement(added)) {
            Interconnection._registerElement(added);
          }
        });


        [].forEach.call(mutation.removedNodes, function (removed) {
          if (Interconnection.isCustomelement(removed)) {
            Interconnection._unregisterElement(removed);
          }
        });
      });
    });

    Interconnection.__domObserver.observe(body, mutation_conf);

  };

  if (!Polymer) {
    window.addEventListener('WebComponentsReady', load_dom);
  } else {
    load_dom();
  }
})(window, document);

