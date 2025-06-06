import { Simulate } from 'react-dom/test-utils';
import Immutable, { Map } from 'immutable';
import { stub } from 'sinon';
import Auth0Lock from '../../src/index';
import webApi from '../../src/core/web_api';
import * as gravatarProvider from '../../src/avatar/gravatar_provider';
import * as ClientSettings from '../../src/core/client/settings';
import clientSettings from './client_settings';
import * as SSOData from '../../src/core/sso/data';
import ssoData from './sso_data';
import enDictionary from '../../src/i18n/en';
import * as i18n from '../../src/i18n';
import { dataFns } from '../../src/utils/data_utils';

const { set } = dataFns(['i18n']);

// stub, mock and spy

export const stubWebApis = () => {
  stub(webApi, 'logIn').returns(undefined);
  stub(webApi, 'signUp').returns(undefined);

  stub(gravatarProvider, 'displayName', (email, cb) => {
    cb(null, 'someone');
  });
  stub(gravatarProvider, 'url', (email, cb) => {
    cb(null, 'https://www.gravatar.com/avatar/35b47dce0e2c9ced8b500dca20e1a657.png?size=160');
  });
  stub(ClientSettings, 'fetchClientSettings', (...args) => {
    args[args.length - 1](null, clientSettings);
  });
  stub(SSOData, 'fetchSSOData', (id, adInfo, cb) => {
    cb(null, ssoData);
  });
  stubGetChallenge();
  stubGetSignupChallenge();
  stubI18n();
};

export const stubI18n = () => {
  stub(i18n, 'initI18n', m => {
    return set(m, 'strings', Immutable.fromJS(enDictionary));
  });
};

export const stubWebApisForKerberos = () => {
  SSOData.fetchSSOData.restore();
  stub(SSOData, 'fetchSSOData', (id, adInfo, cb) => {
    cb(null, ssoData);
  });
};
export const unStubWebApisForKerberos = () => {
  SSOData.fetchSSOData.restore();
  stub(SSOData, 'fetchSSOData', (id, adInfo, cb) => {
    cb(null, ssoData);
  });
};

export const unstubI18n = () => {
  i18n.initI18n.restore();
};

export const assertAuthorizeRedirection = cb => {
  if (webApi.logIn.restore) {
    webApi.logIn.restore();
  }
  stub(webApi, 'logIn', cb);
};

export const assertSignUp = cb => {
  if (webApi.signUp.restore) {
    webApi.signUp.restore();
  }
  stub(webApi, 'signUp', cb);
};

export const restoreWebApis = () => {
  webApi.logIn.restore();
  if (webApi.signUp.restore) {
    webApi.signUp.restore();
  }
  webApi.getChallenge.restore();
  webApi.getSignupChallenge.restore();
  gravatarProvider.displayName.restore();
  gravatarProvider.url.restore();
  ClientSettings.fetchClientSettings.restore();
  SSOData.fetchSSOData.restore();
  unstubI18n();
};

// api call checks

export const wasLoginAttemptedWith = params => {
  const lastCall = webApi.logIn.lastCall;
  if (!lastCall) return false;
  const paramsFromLastCall = lastCall.args[1];

  return Map(params).reduce((r, v, k) => r && paramsFromLastCall[k] === v, true);
};

export const wasLoginAttemptedWithAsync = (params, cb, timeout = 1000) => {
  const startTime = Date.now();

  const int = setInterval(() => {
    const lastCall = webApi.logIn.getCall(0);

    if (lastCall) {
      const paramsFromLastCall = lastCall.args[1];

      cb(Map(params).reduce((r, v, k) => r && paramsFromLastCall[k] === v, true));
      clearInterval(int);
      return;
    }

    if (Date.now() - startTime > timeout) {
      clearInterval(int);
      throw Error('Timeout waiting for login attempt');
    }
  }, 10);
};

export const wasSignUpAttemptedWith = params => {
  const lastCall = webApi.signUp.lastCall;
  if (!lastCall) return false;
  const paramsFromLastCall = lastCall.args[1];

  return Map(params).reduce((r, v, k) => r && paramsFromLastCall[k] === v, true);
};

// rendering

export const displayLock = (name, opts = {}, done = () => {}, show_ops = {}) => {
  switch (name) {
    case 'enterprise and corporate':
      opts.allowedConnections = ['auth0.com', 'rolodato.com'];
      break;
    case 'single database':
      opts.allowedConnections = ['db'];
      break;
    case 'single enterprise':
      opts.allowedConnections = ['auth0.com'];
      break;
    case 'multiple enterprise':
      opts.allowedConnections = ['auth0.com', 'auth10.com'];
      break;
    case 'single corporate':
      opts.allowedConnections = ['rolodato.com'];
      break;
    case 'multiple corporate, one without domain':
      opts.allowedConnections = ['rolodato.com', 'corporate-no-domain'];
      break;
    case 'multiple social':
      opts.allowedConnections = ['facebook', 'twitter', 'github'];
      break;
    case 'kerberos':
      opts.allowedConnections = ['rolodato.com'];
      break;
  }

  const lock = new Auth0Lock('cid', 'domain', opts);
  setTimeout(() => lock.show(show_ops), 175);
  setTimeout(done, 200);
  return lock;
};

// queries

export const q = (lock, query, all = false) => {
  query = `#auth0-lock-container-${lock.id} ${query}`;
  const method = all ? 'querySelectorAll' : 'querySelector';
  return window.document[method](query);
};

const qView = (lock, query, all = false) => {
  // NOTE: When an animation is running, two views will be in the
  // DOM. Both are siblings, and the one that is entering (that is,
  // the one that will remain visible) is always the first sibling.
  const view = q(lock, '.auth0-lock-view-content');
  const method = all ? 'querySelectorAll' : 'querySelector';
  return view ? view[method](query) : null;
};

export function qInput(lock, name, ensure = false) {
  const input = qView(lock, `.auth0-lock-input-${name} input`);
  if (ensure && !input) {
    throw new Error(`Unable to query the '${name}' input value: can't find the input`);
  }
  return input;
}

const hasFn = query => lock => !!q(lock, query);
const hasInputFn = (name, str) => lock => {
  const input = qInput(lock, name);
  return str ? input.value === str : !!input;
};
const hasViewFn = query => lock => !!qView(lock, query);
const hasOneViewFn = query => lock => qView(lock, query, true).length == 1;

const isTabCurrent = (lock, regexp) => {
  // TODO: this won't work with translations, we need another
  // mechanism.
  const currentTabs = qView(lock, '.auth0-lock-tabs-current', true);
  return currentTabs.length === 1 && currentTabs[0].innerText.match(regexp);
};

export const hasAlternativeLink = hasViewFn('.auth0-lock-alternative-link');
export const hasBackButton = hasFn('.auth0-lock-back-button');
export const hasEmailInput = hasInputFn('email');
export const hasLoginSignUpTabs = hasViewFn('.auth0-lock-tabs');
export const hasNoQuickAuthButton = lock => {
  return !qView(lock, '.auth0-lock-socia-button');
};

const hasFlashMessage = (query, lock, message) => {
  const message_ele = q(lock, query);

  if (!message_ele) {
    return false;
  }

  const span = message_ele.querySelector('span');

  if (!span) {
    return false;
  }

  return span.innerText.toLowerCase() === message.toLowerCase();
};
export const hasErrorMessage = (lock, message) => {
  return hasFlashMessage('.auth0-global-message-error', lock, message);
};
export const hasErrorMessageElement = lock => {
  return q(lock, '.auth0-global-message-error');
};
export const hasSuccessMessage = (lock, message) => {
  return hasFlashMessage('.auth0-global-message-success', lock, message);
};
export const hasInfoMessage = (lock, message) => {
  return hasFlashMessage('.auth0-global-message-info', lock, message);
};

export const hasOneSocialButton = hasOneViewFn('.auth0-lock-social-button');
export const hasOneSocialBigButton = hasOneViewFn(
  '.auth0-lock-social-button.auth0-lock-social-big-button'
);
export const hasPasswordInput = hasInputFn('password');
export const hasHiddenPasswordInput = lock =>
  hasFn('.auth0-lock-input-block.auth0-lock-input-show-password.auth0-lock-hidden')(lock) &&
  hasPasswordInput(lock);
export const hasTermsCheckbox = hasFn(
  ".auth0-lock-sign-up-terms-agreement label input[type='checkbox']"
);
export const hasQuickAuthButton = (lock, icon, domain) => {
  // TODO: we should actually check that there's just a single button
  const xs = qView(lock, `.auth0-lock-social-button[data-provider^="${icon}"]`, true);
  return xs.length === 1 && xs[0].innerText.toLowerCase().indexOf(domain) !== -1;
};
export const hasSocialButtons = hasViewFn('.auth0-lock-social-button');
export const hasSSONotice = hasViewFn('.auth0-sso-notice-container');
export const hasSubmitButton = hasFn('button.auth0-lock-submit[name=submit]');
export const hasSubmitButtonVisible = lock =>
  q(lock, 'button.auth0-lock-submit[name=submit]', false).style.display === 'block';
export const hasUsernameInput = hasInputFn('username');
export const isLoginTabCurrent = lock => isTabCurrent(lock, /log in/i);
export const isSignUpTabCurrent = lock => isTabCurrent(lock, /sign up/i);
export const isSubmitButtonDisabled = hasFn('button.auth0-lock-submit[disabled]');
export const haveShownError = (lock, msg) => {
  const errorElement = q(lock, '.auth0-global-message-error span');

  return errorElement.innerText.toLowerCase() === msg.toLowerCase();
};
// interactions

const check = (lock, query) => {
  Simulate.change(q(lock, query), {});
};
const click = (lock, query) => {
  Simulate.click(q(lock, query));
};
const checkFn = query => lock => check(lock, query);
const clickFn = (lock, query) => click(lock, query);
export const clickTermsCheckbox = checkFn(
  ".auth0-lock-sign-up-terms-agreement label input[type='checkbox']"
);

export const clickRefreshCaptchaButton = (lock, connection) =>
  clickFn(lock, `.auth0-lock-captcha-refresh`);

export const clickSocialConnectionButton = (lock, connection) =>
  clickFn(lock, `.auth0-lock-social-button[data-provider='${connection}']`);

export const clickSignUpTab = (lock) => {
  // there is no id for the unselected tab (Login is selected by default)
  const signUpTab = window.document['querySelector']('.auth0-lock-tabs > li:nth-child(2) > a');
  Simulate.click(signUpTab, {});
};

const fillInput = (lock, name, str) => {
  Simulate.change(qInput(lock, name, true), { target: { value: str } });
};
const fillInputFn = name => (lock, str) => fillInput(lock, name, str);

export const fillEmailInput = fillInputFn('email');
export const fillPasswordInput = fillInputFn('password');
export const fillComplexPassword = lock => fillInputFn('password')(lock, generateComplexPassword());
export const fillCaptchaInput = fillInputFn('captcha');
export const fillUsernameInput = fillInputFn('username');
export const fillMFACodeInput = fillInputFn('mfa_code');

export const submit = lock => {
  // reset web apis
  restoreWebApis();
  stubWebApis();

  submitForm(lock);
};

export const submitForm = lock => {
  const form = q(lock, '.auth0-lock-widget');
  if (!form || form.tagName.toUpperCase() !== 'FORM') {
    throw new Error("Unable to submit form: can't find the element");
  }

  Simulate.submit(form, {});
};

export const waitUntilExists = (lock, selector, cb, timeout = 1000) => {
  const startedAt = Date.now();

  const interval = setInterval(() => {
    if (Date.now() - startedAt >= timeout) {
      clearInterval(interval);
      throw new Error(`Timeout waiting for ${selector} to become available`);
    }

    const el = q(lock, selector);

    if (el) {
      clearInterval(interval);
      cb(null, el);
    }
  }, 10);
};

export const waitUntilInputExists = (lock, name, cb, timeout) =>
  waitUntilExists(lock, `.auth0-lock-input-${name} input`, cb, timeout);

export const waitUntilCaptchaExists = (lock, cb, timeout) =>
  waitUntilInputExists(lock, 'captcha', cb, timeout);

export const waitUntilErrorExists = (lock, cb, timeout) =>
  waitUntilExists(lock, '.auth0-global-message-error span', cb, timeout);

export const waitUntilSuccessFlashExists = (lock, cb, timeout) =>
  waitUntilExists(lock, '.auth0-global-message-success', cb, timeout);

export const waitUntilInfoFlashExists = (lock, cb, timeout) =>
  waitUntilExists(lock, '.auth0-global-message-info', cb, timeout);

export const waitForSSONotice = (lock, cb, timeout) =>
  waitUntilExists(lock, '.auth0-sso-notice-container', cb, timeout);

export const waitForQuickAuthButton = (lock, icon, cb, timeout) =>
  waitUntilExists(lock, `.auth0-lock-social-button[data-provider^="${icon}"]`, cb, timeout);
// login

export const waitForEmailAndPasswordInput = (lock, cb, timeout) => {
  waitUntilInputExists(
    lock,
    'email',
    () => {
      waitUntilInputExists(lock, 'password', cb, timeout);
    },
    timeout
  );
};

export const waitForUsernameAndPasswordInput = (lock, cb, timeout) => {
  waitUntilInputExists(
    lock,
    'username',
    () => {
      waitUntilInputExists(lock, 'password', cb, timeout);
    },
    timeout
  );
};

/**
 * Builds a function that waits for waitFn to complete (usually something that looks for elements to appear on screen) before executing fn. Used as a building block to contruct higher-order waiting functions.
 * @param {*} fn The function to execute when waitFn has completed
 * @param {*} waitFn The 'waiting' function that blocks fn, usually something that waits for elements to appear
 * @returns A function that can be given a lock instance and a callback for when the function has completed
 */
const loginWaitFn = (fn, waitFn) => (lock, cb) => {
  if (cb) {
    waitFn(lock, () => {
      fn(lock);
      cb();
    });
  } else {
    fn(lock);
  }
};

export const logInWithEmailAndPassword = loginWaitFn(lock => {
  fillEmailInput(lock, 'someone@example.com');
  fillPasswordInput(lock, 'mypass');
  submit(lock);
}, waitForEmailAndPasswordInput);

export const logInWithEmailPasswordAndCaptcha = loginWaitFn(lock => {
  fillEmailInput(lock, 'someone@example.com');
  fillPasswordInput(lock, 'mypass');
  fillCaptchaInput(lock, 'captchaValue');
  submit(lock);
}, waitForEmailAndPasswordInput);

/**
 * The mocked connection has password policy "fair". So I need an strong password
 */
function generateComplexPassword() {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-*/=?>~><';
  var charactersLength = characters.length;
  for (var i = 0; i < 50; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export const signUpWithEmailAndPassword = loginWaitFn(lock => {
  fillEmailInput(lock, 'someone@example.com');
  fillPasswordInput(lock, generateComplexPassword());
  submit(lock);
}, waitForEmailAndPasswordInput);

export const signUpWithEmailPasswordAndCaptcha = loginWaitFn(lock => {
  fillEmailInput(lock, 'someone@example.com');
  fillPasswordInput(lock, generateComplexPassword());
  fillCaptchaInput(lock, 'captchaValue');
  submit(lock);
}, waitForEmailAndPasswordInput);

export const logInWithUsernameAndPassword = loginWaitFn(lock => {
  fillUsernameInput(lock, 'someone');
  fillPasswordInput(lock, 'mypass');
  submit(lock);
}, waitForUsernameAndPasswordInput);

export const logInWithUsernamePasswordAndCaptcha = loginWaitFn(lock => {
  fillUsernameInput(lock, 'someone');
  fillPasswordInput(lock, 'mypass');
  fillCaptchaInput(lock, 'captchaValue');
  submit(lock);
}, waitForUsernameAndPasswordInput);

// Helps to keep the context of what happened on a test that
// was executed as part of an async flow, the normal use
// case is to pass mocha done as the done param.
export const testAsync = (fn, done) => {
  try {
    fn();
    done();
  } catch (e) {
    done(e);
  }
};

export const stubGetChallenge = (result = { required: false }) => {
  if (typeof webApi.getChallenge.restore === 'function') {
    webApi.getChallenge.restore();
  }
  return stub(webApi, 'getChallenge', (lockID, callback) => {
    if (Array.isArray(result)) {
      return callback(null, result.shift());
    }
    callback(null, result);
  });
};

export const stubGetSignupChallenge = (result = { required: false }) => {
  if (typeof webApi.getSignupChallenge.restore === 'function') {
    webApi.getSignupChallenge.restore();
  }
  return stub(webApi, 'getSignupChallenge', (lockID, callback) => {
    if (Array.isArray(result)) {
      return callback(null, result.shift());
    }
    callback(null, result);
  });
};
