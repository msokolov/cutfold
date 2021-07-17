/*
  Cutfold unit test framework
*/

function assert(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
}

function assert_equals(a, b, message) {
  if (a != b) {
    if (message) {
      throw new Error(`${a} != ${b}: ${message}`);
    } else {
      throw new Error(`${a} != ${b}`);
    }
  }
}

var UT = {

  /** Unit Tests are consided "passing" if they do not throw an exception. Any return value is ignored. */
  tests: {

    hello_world: function() {
      /* always pass; tests the unit testing framework */
    },

    fail: function() {
      /* always fail; tests the unit testing framework */
      throw new Error("embrace failure");
    },

    /* Vertex tests */
    Vertex_create: function() {
      var v = new Vertex(100, 200);
      assert_equals(v.id, Vertex.next_id - 1);
      assert(v.x == 100);
      assert(v.y == 200);
      assert(v.next == null);
      assert(!v.is_crease);
      assert(v.fold == null);
      assert(v.poly == null);
    },

    Vertex_copy: function() {
      var v = new Vertex(100, 200);
      v.next = 1;
      v.fold = 1;
      v.poly = 1;
      v.is_crease = true;
      v1 = v.copy();
      // these attributes are copied
      assert_equals(v1.x, v.x);
      assert_equals(v1.y, v.y);
      assert(v1.is_crease);
      // these are not
      assert_equals(v1.next, null);
      assert(v1.fold == null);
      assert(v1.poly == null);
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
      if (ex.message) {
        UT.fail(test_target, ex.message);
      } else {
        var stack = ex.stack;
        var stack_index = window.chrome ? 2 : 1;
        UT.fail(test_target, stack.split('\n')[stack_index]);
      }
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
