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

function ut_rotate(x, y, radians) {
  var sin = Math.sin(radians);
  var cos = Math.cos(radians);
  return [x*cos + y*sin, y*cos - x*sin];
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
    },

    Vertex_xml: function() {
      var v = new Vertex(1, 2);
      assert_equals(v.xml(), `<vertex id="${v.id}" x="1" y="2" is_crease="false"></vertex>`);
      var v1 = new Vertex(2, 3);
      v.fold  = new Fold(v, 4, 5);
      v.fold.twin = new Fold(v1, 4, 5);
      v.fold.other_twin = v;
      assert_equals(v.xml(), `<vertex id="${v.id}" x="1" y="2" is_crease="false"><fold twin="${v1.id}" level="4" index="5"/></vertex>`);
    },

    Vertex_string: function() {
      var v = new Vertex(1, 2);
      assert_equals(v.string(), "(1,2)")
      v.next = new Vertex(2, 4);
      assert_equals(v.string(), "(1,2)->(2,4)")
    },

    Vertex_findPrev: function() {
      var v = new Vertex(1, 2);
      v.next = v;
      assert_equals(v, v.findPrev());
      var v1 = new Vertex(2, 3);
      v.next = v1;
      v1.next = v;
      assert_equals(v1, v.findPrev());
      assert_equals(v, v1.findPrev());
      var v2 = new Vertex(3, 4);
      v1.next = v2;
      v2.next = v;
      assert_equals(v2, v.findPrev());
      assert_equals(v, v1.findPrev());
      assert_equals(v1, v2.findPrev());
    },

    // TODO: test Vertex.join. It is kind of tricky
    Vertex_join: function() {
    },

    Vertex_d2: function() {
      var v = new Vertex(1, 2);
      assert_equals(v.distanceSquared(v), 0);
      var v1 = new Vertex(2, 4);
      assert_equals(v1.distanceSquared(v1), 0);
      assert_equals(v.distanceSquared(v1), 5);
      assert_equals(v1.distanceSquared(v), 5);
    },

    Vertex_eq: function() {
      var v = new Vertex(1, 2);
      assert(v.eq(v));
      assert(v.eq(new Vertex(1.001, 2)) == false);
      assert(v.eq(new Vertex(1.00001, 2)));
    },

    Vertex_parallel: function() {
      var v0 = new Vertex(0, 0);
      v0.next = new Vertex(1, 2);
      v0.next.next = v0;
      var v1 = new Vertex(2, 4);
      v1.next = new Vertex(4, 8);
      v1.next.next = v1;
      assert(v0.parallel(v1));
      assert(v1.parallel(v0));
      assert(v0.next.parallel(v1));
      assert(v1.next.parallel(v0));

      var v2 = new Vertex(0, 0);
      v2.next = new Vertex(1, 0);
      assert(v2.parallel(v0) == false);
      assert(v0.parallel(v2) == false);
    },

    Vertex_parallel_random: function() {
      var v0 = new Vertex(Math.random(), Math.random());
      v0.next = new Vertex(Math.random(), Math.random());
      // copy v0
      var v1 = v0.copy();
      v1.next = v0.next.copy();

      assert(v0.parallel(v1));
      assert(v1.parallel(v0));

      // apply a random offset
      var xoff = Math.random();
      v1.x += xoff;
      v1.next.x += xoff;
      var yoff = Math.random();
      v1.y += yoff;
      v1.next.y += yoff;

      assert(v0.parallel(v1));
      assert(v1.parallel(v0));

      // apply a random scale
      var scale = Math.random();
      v1.x *= scale;
      v1.next.x *= scale;
      v1.y *= scale;
      v1.next.y *= scale;

      assert(v0.parallel(v1));
      assert(v1.parallel(v0), `[${v1.xml()},${v1.next.xml()}] !|| [${v0.xml()},${v0.next.xml()}]; scale=${scale} xoff=${xoff} yoff=${yoff}`);

      // Now rotate some random amount
      for (var i = 0; i < 10; i ++) {
        var radians = Math.random() - 0.5;
        var xy = ut_rotate(v1.x, v1.y, radians);
        var vr = new Vertex(xy[0], xy[1]);
        xy = ut_rotate(v1.next.x, v1.next.y, radians);
        vr.next = new Vertex(xy[0], xy[1]);
        // This is squdgy, it will probably fail
        if (Math.abs(radians) < 0.001) {
          assert(v0.parallel(vr));
        } else if (Math.abs(radians) > 0.01) {
          assert(v0.parallel(vr) == false,
                 `[${v0.xml()},${v0.next.xml()}] !|| [${vr.xml()},${vr.next.xml()}]; rotate=${radians}`);
        }
      }
    },

    Vertex_intersectTest: function() {
    },

    Vertex_rectOverlap: function() {
    },

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
      var stack = ex.stack;
      var stack_index = window.chrome ? 2 : 1;
      if (ex.message) {
        UT.fail(test_target, ex.message + ': ' + stack.split('\n')[stack_index]);
      } else {
        UT.fail(test_target, stack.split('\n')[stack_index]);
      }
      return;
    }
    UT.ok(test_target);
  },

  test_output: function(test_target, message, result_class) {
    var test_name = test_target.getAttribute('name');
    //console.log(`${test_name}: ${message}`);
    var result = document.createElement("div");
    result.classList.add(result_class);
    result.appendChild(document.createTextNode(message));
    //span.className = result_class;
    test_target.appendChild(result);
  },

  fail: function(test_target, message) {
    UT.test_output(test_target, `FAIL ${message}`, "ut-fail");
  },

  ok: function(test_target) {
    UT.test_output(test_target, "ok", "ut-ok");
  },

};
