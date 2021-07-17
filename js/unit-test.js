/*
  Cutfold unit test framework
*/

var UT = {

  tests: {
    /** Unit Tests are consided "passing" if they do not throw an exception. Any return value is ignored. */
    hello_world: function () {
    },
    fail: function () {
      throw new Error("embrace failure");
    }
  },

  run_all_tests: function() {
    var tests = document.getElementById('unit-tests');
    for (var test = tests.firstElementChild; test; test = test.nextElementSibling) {
      UT.run(test);
    }
  },

  click: function(e) {
    UT.run(e.target)
  },

  run: function(test_target) {
    var test_name = test_target.getAttribute('name');
    //console.log(test_target);
    //console.log(`Test: ${test_name}`);
    //console.log(test_target.parentNode);
    //console.log(UT.tests[test_name]);
    try {
      var test_function = UT.tests[test_name];
      if (!test_function) {
        UT.fail(test_target, `UT.tests.${test_name} not found`);
        return;
      }
      test_function();
    } catch (ex) {
      UT.fail(test_target, ex.message);
      return;
    }
    UT.ok(test_target);
  },

  test_output: function(test_target, message, result_class) {
    var test_name = test_target.getAttribute('name');
    console.log(`${test_name}: ${message}`);
    var span = document.createElement("span");
    span.classList.add(result_class);
    span.appendChild(document.createTextNode(message));
    //span.className = result_class;
    test_target.appendChild(span);
  },

  fail: function(test_target, message) {
    UT.test_output(test_target, `FAIL ${message}`, "ut-fail");
  },

  ok: function(test_target) {
    UT.test_output(test_target, "ok", "ut-ok");
  },

};
