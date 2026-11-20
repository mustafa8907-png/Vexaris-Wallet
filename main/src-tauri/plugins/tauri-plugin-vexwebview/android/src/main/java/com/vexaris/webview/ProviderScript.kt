package com.vexaris.webview

internal object ProviderScript {

  fun source(initialStateJson: String): String =
    "window.__vexInit = " + initialStateJson + ";\n" + PROVIDER

  private const val PROVIDER = """
(function () {
  if (window.top !== window.self) return;

  var init = window.__vexInit || {};
  var nextId = 1;
  var pending = Object.create(null);
  var handlers = Object.create(null);
  var chainId = typeof init.chainId === 'string' ? init.chainId : null;
  var accounts = Array.isArray(init.accounts) ? init.accounts.slice() : [];
  var connected = init.connected === true && accounts.length > 0;

  function emit(name, payload) {
    var list = handlers[name];
    if (!list || !list.length) return;
    list.slice().forEach(function (fn) {
      try { fn(payload); } catch (e) { }
    });
  }

  function sync() {
    provider.chainId = chainId;
    provider.networkVersion = chainId ? String(parseInt(chainId, 16)) : null;
    provider.selectedAddress = accounts.length ? accounts[0] : null;
  }

  function rpcError(message, code) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  function request(method, params) {
    return new Promise(function (resolve, reject) {
      var bridge = window.vexBridge || window.VexBridge;
      if (!bridge || typeof bridge.postMessage !== 'function') {
        reject(rpcError('Vexaris koprusu bu sayfada yok', 4900));
        return;
      }
      var id = nextId++;
      pending[id] = { resolve: resolve, reject: reject };
      try {
        bridge.postMessage(JSON.stringify({
          id: id,
          method: method,
          params: params === undefined || params === null ? [] : params
        }));
      } catch (e) {
        delete pending[id];
        reject(rpcError('Istek gonderilemedi', -32603));
      }
    });
  }

  window.__vexReply = function (json) {
    var msg;
    try { msg = JSON.parse(json); } catch (e) { return; }
    if (!msg) return;

    if (msg.type === 'event') {
      if (msg.name === 'chainChanged') {
        chainId = msg.data;
        connected = accounts.length > 0;
      } else if (msg.name === 'accountsChanged') {
        accounts = Array.isArray(msg.data) ? msg.data.slice() : [];
        connected = accounts.length > 0;
      } else if (msg.name === 'connect') {
        connected = true;
        if (msg.data && typeof msg.data.chainId === 'string') chainId = msg.data.chainId;
      } else if (msg.name === 'disconnect') {
        connected = false;
        accounts = [];
      }
      sync();
      emit(msg.name, msg.data);
      return;
    }

    var entry = pending[msg.id];
    if (!entry) return;
    delete pending[msg.id];
    if (msg.error) {
      var error = rpcError(msg.error.message || 'Istek reddedildi',
        typeof msg.error.code === 'number' ? msg.error.code : 4001);
      if (msg.error.data !== undefined) error.data = msg.error.data;
      entry.reject(error);
    } else {
      if (msg.method === 'eth_requestAccounts' || msg.method === 'eth_accounts') {
        accounts = Array.isArray(msg.result) ? msg.result.slice() : [];
        connected = accounts.length > 0;
        sync();
      } else if (msg.method === 'eth_chainId' && typeof msg.result === 'string') {
        chainId = msg.result;
        sync();
      }
      entry.resolve(msg.result);
    }
  };

  if (window.__vexPending && window.__vexPending.length) {
    var queued = window.__vexPending.splice(0);
    for (var qi = 0; qi < queued.length; qi++) {
      try { window.__vexReply(queued[qi]); } catch (e) { }
    }
  }

  if (window.ethereum && window.ethereum.isVexaris) return;

  var provider = {
    isVexaris: true,
    isMetaMask: true,
    chainId: chainId,
    networkVersion: null,
    selectedAddress: null,

    isConnected: function () { return connected; },

    request: function (args) {
      if (!args || typeof args.method !== 'string') {
        return Promise.reject(rpcError('Gecersiz istek', -32600));
      }
      return request(args.method, args.params);
    },

    on: function (name, fn) {
      if (typeof fn !== 'function') return provider;
      (handlers[name] = handlers[name] || []).push(fn);
      return provider;
    },

    addListener: function (name, fn) { return provider.on(name, fn); },

    once: function (name, fn) {
      if (typeof fn !== 'function') return provider;
      var wrapped = function (payload) {
        provider.removeListener(name, wrapped);
        fn(payload);
      };
      return provider.on(name, wrapped);
    },

    removeListener: function (name, fn) {
      var list = handlers[name];
      if (list) {
        var index = list.indexOf(fn);
        if (index >= 0) list.splice(index, 1);
      }
      return provider;
    },

    off: function (name, fn) { return provider.removeListener(name, fn); },

    removeAllListeners: function (name) {
      if (name) delete handlers[name];
      else handlers = Object.create(null);
      return provider;
    },

    listenerCount: function (name) { return (handlers[name] || []).length; },

    enable: function () { return request('eth_requestAccounts', []); },

    send: function (methodOrPayload, paramsOrCallback) {
      if (typeof methodOrPayload === 'string') {
        return request(methodOrPayload, Array.isArray(paramsOrCallback) ? paramsOrCallback : []);
      }
      var payload = methodOrPayload || {};
      if (typeof paramsOrCallback === 'function') {
        provider.sendAsync(payload, paramsOrCallback);
        return undefined;
      }
      if (payload.method === 'eth_accounts') return { id: payload.id, jsonrpc: '2.0', result: accounts };
      if (payload.method === 'eth_chainId') return { id: payload.id, jsonrpc: '2.0', result: chainId };
      if (payload.method === 'net_version') {
        return { id: payload.id, jsonrpc: '2.0', result: chainId ? String(parseInt(chainId, 16)) : null };
      }
      return request(payload.method, payload.params);
    },

    sendAsync: function (payload, callback) {
      request(payload.method, payload.params).then(function (result) {
        callback(null, { id: payload.id, jsonrpc: '2.0', result: result });
      }, function (error) {
        callback(error, null);
      });
    },

    _metamask: {
      isUnlocked: function () { return Promise.resolve(true); },
      requestBatch: function (list) {
        return Promise.all((list || []).map(function (item) { return provider.request(item); }));
      }
    }
  };

  sync();

  try {
    Object.defineProperty(window, 'ethereum', {
      value: provider, writable: false, configurable: false, enumerable: true
    });
  } catch (e) {
    window.ethereum = provider;
  }

  if (!window.web3) window.web3 = { currentProvider: provider, __isVexaris: true };

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
    '<rect width="48" height="48" rx="12" fill="#0e0d13"/>' +
    '<path d="M24 9l11 15-11 15-11-15 11-15z" fill="#e5484d"/>' +
    '<path d="M24 9l11 15-11 4-11-4 11-15z" fill="#ff7a7f"/></svg>';
  var info = {
    uuid: '9f1c0f3e-6b21-4c0a-9a52-7d3f21b8c4e1',
    name: 'Vexaris Wallet',
    icon: 'data:image/svg+xml;base64,' + btoa(svg),
    rdns: 'com.vexaris.wallet'
  };
  function announce(event) {
    var detail = Object.freeze({ info: Object.freeze(info), provider: provider });
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: detail }));
    if (event && event.detail) {
      try { event.detail(Object.freeze({ info: Object.freeze(info), provider: provider })); } catch (e) {}
    }
  }
  window.addEventListener('eip6963:requestProvider', announce);
  announce(null);

  window.dispatchEvent(new Event('ethereum#initialized'));
})();
"""
}