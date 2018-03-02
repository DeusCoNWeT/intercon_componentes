(function () {

  var interconnection;
  var DomHandler;
  var testProducer;
  var assert = chai.assert;

  beforeEach(function () {
    if (window.__html__) {
      document.write(window.__html__['getCustomElements']);
    }
    interconnection = window.interconnection;
    DomHandler = interconnection.DomHandler;
  });

  describe('Check getCustomElements', function () {

    it('Check if DomHandler is defined', function () {
      assert.isDefined(interconnection, 'Interconnection is not defined');
      assert.isDefined(DomHandler, 'DomHandler is not defined');
    });
    it('Check if Polymer is defined', function () {
      try {
        DomHandler.getCustomElements();
        //window.Polymer = polymer;
        assert.fail(null, null, 'Deberia lanzar un error');
      } catch (err) {
        //window.Polymer = polymer;
        assert.instanceOf(err, Error, 'Deberia ser un seria un error');
      }


    });
    it('Check if list is empty', function () {
      var list = DomHandler.getCustomElements();
      assert.instanceOf(list, NodeList, 'Should be an HTMLElement');
      console.log(window.__html__);
      assert.isNotEmpty(list, 'It should not be an empty array');
      assert.lengthOf(list, 3, 'Length should be 3');
      list.forEach(function (element) {
        assert.instanceOf(element, HTMLElement, 'Should be an HTMLElement');
      });
    });

  });
})();
