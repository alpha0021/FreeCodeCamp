/* eslint-disable no-eval, no-process-exit */
import _ from 'lodash';
import { Observable } from 'rx';
import tape from 'tape';
import getChallenges from './getChallenges';


function createIsAssert(t, isThing) {
  const { assert } = t;
  return function() {
    const args = [...arguments];
    args[0] = isThing(args[0]);
    assert.apply(t, args);
  };
}

function fillAssert(t) {
  const assert = t.assert;

  assert.isArray = createIsAssert(t, _.isArray);
  assert.isBoolean = createIsAssert(t, _.isBoolean);
  assert.isString = createIsAssert(t, _.isString);
  assert.isNumber = createIsAssert(t, _.isNumber);
  assert.isUndefined = createIsAssert(t, _.isUndefined);

  assert.deepEqual = t.deepEqual;
  assert.equal = t.equal;
  assert.strictEqual = t.equal;

  assert.sameMembers = function sameMembers() {
    const [ first, second, ...args] = arguments;
    assert.apply(
      t,
      [
        _.difference(first, second).length === 0 &&
        _.difference(second, first).length === 0
      ].concat(args)
    );
  };

  assert.includeMembers = function includeMembers() {
    const [ first, second, ...args] = arguments;
    assert.apply(t, [_.difference(second, first).length === 0].concat(args));
  };

  assert.match = function match() {
    const [value, regex, ...args] = arguments;
    assert.apply(t, [regex.test(value)].concat(args));
  };

  return assert;
}

function createTest({ title, tests = [], solutions = [] }) {
  const plan = tests.length;
  return Observable.fromCallback(tape)(title)
    .doOnNext(t => solutions.length ? t.plan(plan) : t.end())
    .flatMap(t => {
      if (solutions.length <= 0) {
        t.comment('No solutions for ' + title);
        return Observable.just({
          title,
          type: 'missing'
        });
      }

      return Observable.just(t)
        .map(fillAssert)
        /* eslint-disable no-unused-vars */
        // assert is used within the eval
        .doOnNext(assert => {
        /* eslint-enable no-unused-vars */
          solutions.forEach(solution => {
            tests.forEach(test => {
              try {
                eval(solution + ';;' + test);
              } catch (e) {
                t.fail(e);
              }
            });
          });
        })
        .map(() => ({ title }));
    });
}

Observable.from(getChallenges())
  .flatMap(challengeSpec => {
    return Observable.from(challengeSpec.challenges);
  })
  .flatMap(challenge => {
    return createTest(challenge);
  })
  .map(({ title, type }) => {
    if (type === 'missing') {
      return title;
    }
    return false;
  })
  .filter(title => !!title)
  .toArray()
  .subscribe(
    (noSolutions) => {
      console.log(
        '# These challenges have no solutions\n- [ ] ' +
          noSolutions.join('\n- [ ] ')
      );
    },
    err => { throw err; },
    () => process.exit(0)
  );

