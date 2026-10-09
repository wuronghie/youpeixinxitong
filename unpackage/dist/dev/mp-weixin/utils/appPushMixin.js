"use strict";
const utils_chatPush = require("./chatPush.js");
function createAppPushMixin(types, handlerName = "onAppPushPayload") {
  const typeList = Array.isArray(types) ? types : [types];
  return {
    onShow() {
      this._bindAppPush();
    },
    onHide() {
      this._unbindAppPush();
    },
    onUnload() {
      this._unbindAppPush();
    },
    methods: {
      _bindAppPush() {
        if (this._appPushHandler)
          return;
        this._appPushHandler = (payload) => {
          const now = Date.now();
          if (this._appPushAt && now - this._appPushAt < 400)
            return;
          this._appPushAt = now;
          const fn = this[handlerName];
          if (typeof fn === "function")
            fn.call(this, payload);
        };
        utils_chatPush.onAppPush(typeList, this._appPushHandler);
      },
      _unbindAppPush() {
        if (!this._appPushHandler)
          return;
        utils_chatPush.offAppPush(this._appPushHandler);
        this._appPushHandler = null;
      }
    }
  };
}
exports.createAppPushMixin = createAppPushMixin;
//# sourceMappingURL=../../.sourcemap/mp-weixin/utils/appPushMixin.js.map
