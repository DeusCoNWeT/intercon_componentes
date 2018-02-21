(function () {

  var interconnection;
  var DomHandler;
  var targetElement;
  var assert = chai.assert;
  var expect = chai.expect;

  before(function () {
    interconnection = window.interconnection;
    DomHandler = interconnection.DomHandler;
    targetElement = document.querySelector('test-producer');
  });

  describe('Check getElementProperties', function () {
    it('Check get element properties return an object', function () {
      var properties_element = DomHandler.getElementProperties('#test-producer');
      assert.isObject(properties_element, 'Properties is not an object');
    });
    it('Pass invalid element', function () {
      try {
        DomHandler.getElementProperties('');
        assert.fail(null, null, 'Should throw an error');
      } catch (err) {
        assert.instanceOf(err, Error, 'Should throw an object instance of Error');
      }
    });

    it('Pass an HTML element', function () {
      assert.isObject(DomHandler.getElementProperties(targetElement), 'Should return an object');
    });

    it('Check own properties', function () {
      var properties = DomHandler.getElementProperties(targetElement);
      assert.isDefined(window.Polymer);
      assert.isDefined(window.Polymer.telemetry);
      assert.isDefined(properties, 'properties is undefined');
      // Check properties
      assert.isNotNull(properties.test, 'Undefined "test" property defined in test-producer component');
    });

    it('Check inherited properties', function () {
      var properties = DomHandler.getElementProperties(targetElement);
      assert.isNotNull(properties.inheritedProperty, 'inhereted properties are missing');

    });

    it('Should throw an error. Invalid HTMLElement', function () {
      try {
        DomHandler.getElementProperties(document.createElement('div'));
      } catch (err) {
        assert.instanceOf(err, Error, 'Should throw an object instance of Error');
      }
    });

  });
})();
