"use strict";
const common_vendor = require("../common/vendor.js");
const utils_location = require("../utils/location.js");
const utils_reverseGeocode = require("../utils/reverseGeocode.js");
const _sfc_main = {
  name: "LocationBar",
  data() {
    return {
      loading: false,
      location: null,
      locationText: "定位中..."
    };
  },
  mounted() {
    this.loadLocation();
  },
  onShow() {
    this.loadLocation();
  },
  methods: {
    /**
     * 加载位置信息
     */
    async loadLocation() {
      const cachedLocation = common_vendor.index.getStorageSync("currentLocation");
      common_vendor.index.__f__("log", "at components/LocationBar.vue:38", "[LocationBar] 从缓存读取位置:", cachedLocation);
      if (cachedLocation) {
        this.location = cachedLocation;
        this.updateLocationText();
      } else {
        this.locationText = "定位中...";
      }
      if (cachedLocation) {
        setTimeout(() => {
          this.getLocation();
        }, 500);
      } else {
        await this.getLocation();
      }
    },
    /**
     * 获取当前位置
     */
    async getLocation() {
      if (this.loading)
        return;
      this.loading = true;
      try {
        const hasPermission = await utils_location.requestLocationPermission();
        if (!hasPermission) {
          this.locationText = "定位失败";
          this.loading = false;
          return;
        }
        const location = await utils_location.getCurrentLocation({
          highAccuracy: false,
          // 使用普通精度，更快
          timeout: 5e3
        });
        common_vendor.index.__f__("log", "at components/LocationBar.vue:79", "[LocationBar] 获取到位置数据:", location);
        let locationData = {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address || "",
          city: location.city || "",
          province: location.province || "",
          district: location.district || "",
          speed: location.speed || 0,
          accuracy: location.accuracy || 0
        };
        if (!locationData.city && !locationData.address && locationData.latitude && locationData.longitude) {
          try {
            common_vendor.index.__f__("log", "at components/LocationBar.vue:96", "[LocationBar] 调用逆地理编码API获取地址信息...");
            const addressInfo = await utils_reverseGeocode.reverseGeocode(
              parseFloat(locationData.latitude),
              parseFloat(locationData.longitude)
            );
            locationData = {
              ...locationData,
              city: addressInfo.city || locationData.city || "",
              province: addressInfo.province || locationData.province || "",
              district: addressInfo.district || locationData.district || "",
              address: addressInfo.address || locationData.address || ""
            };
            common_vendor.index.__f__("log", "at components/LocationBar.vue:111", "[LocationBar] 逆地理编码结果:", locationData);
          } catch (error) {
            common_vendor.index.__f__("error", "at components/LocationBar.vue:113", "[LocationBar] 逆地理编码失败:", error);
          }
        }
        this.location = locationData;
        common_vendor.index.setStorageSync("currentLocation", locationData);
        common_vendor.index.__f__("log", "at components/LocationBar.vue:121", "[LocationBar] 保存的位置数据:", locationData);
        this.updateLocationText();
      } catch (error) {
        common_vendor.index.__f__("error", "at components/LocationBar.vue:126", "[位置栏] 获取位置失败:", error);
        const cachedLocation = common_vendor.index.getStorageSync("currentLocation");
        if (cachedLocation) {
          this.location = cachedLocation;
          this.updateLocationText();
        } else {
          this.locationText = "定位失败";
        }
      } finally {
        this.loading = false;
      }
    },
    /**
     * 更新位置显示文本
     */
    updateLocationText() {
      if (!this.location) {
        this.locationText = "定位中...";
        return;
      }
      if (this.location.city && this.location.city.trim()) {
        this.locationText = this.location.city.replace(/市$/, "");
        return;
      }
      if (this.location.address && this.location.address.trim()) {
        const addressInfo = utils_location.parseAddress(this.location.address);
        if (addressInfo.city) {
          this.locationText = addressInfo.city.replace(/市$/, "");
        } else if (addressInfo.district) {
          this.locationText = addressInfo.district.replace(/区$|县$/, "");
        } else if (this.location.address) {
          const cityMatch = this.location.address.match(/(.+?市)/);
          if (cityMatch) {
            this.locationText = cityMatch[1].replace(/市$/, "");
          } else {
            const addrText = this.location.address.trim();
            if (addrText.length > 10) {
              this.locationText = addrText.substring(0, 10) + "...";
            } else {
              this.locationText = addrText;
            }
          }
        } else {
          this.locationText = "定位失败";
        }
      } else if (this.location.latitude && this.location.longitude) {
        const cachedLocation = common_vendor.index.getStorageSync("currentLocation");
        if (cachedLocation) {
          if (cachedLocation.city && cachedLocation.city.trim()) {
            this.locationText = cachedLocation.city.replace(/市$/, "");
            return;
          }
          if (cachedLocation.address && cachedLocation.address.trim()) {
            const addressInfo = utils_location.parseAddress(cachedLocation.address);
            if (addressInfo.city) {
              this.locationText = addressInfo.city.replace(/市$/, "");
              return;
            } else if (addressInfo.district) {
              this.locationText = addressInfo.district.replace(/区$|县$/, "");
              return;
            } else {
              const cityMatch = cachedLocation.address.match(/(.+?市)/);
              if (cityMatch) {
                this.locationText = cityMatch[1].replace(/市$/, "");
                return;
              }
            }
          }
        }
        this.locationText = "定位成功";
      } else {
        this.locationText = "定位失败";
      }
    },
    /**
     * 点击位置栏
     */
    async handleLocationClick() {
      if (this.location && this.location.latitude && this.location.longitude && !this.location.city && !this.location.address) {
        try {
          const hasPermission = await utils_location.requestLocationPermission();
          if (!hasPermission) {
            common_vendor.index.showToast({
              title: "需要位置权限",
              icon: "none"
            });
            return;
          }
          const location = await utils_location.chooseLocation({
            latitude: parseFloat(this.location.latitude),
            longitude: parseFloat(this.location.longitude)
          });
          const locationData = {
            latitude: location.latitude.toString(),
            longitude: location.longitude.toString(),
            address: location.address || "",
            city: location.city || "",
            province: location.province || "",
            district: location.district || "",
            speed: this.location.speed || 0,
            accuracy: this.location.accuracy || 0
          };
          this.location = locationData;
          common_vendor.index.setStorageSync("currentLocation", locationData);
          common_vendor.index.__f__("log", "at components/LocationBar.vue:257", "[LocationBar] 通过chooseLocation获取到地址信息:", locationData);
          this.updateLocationText();
        } catch (error) {
          if (error.message && !error.message.includes("取消")) {
            common_vendor.index.__f__("error", "at components/LocationBar.vue:263", "[LocationBar] 选择位置失败:", error);
            this.getLocation();
          }
        }
      } else {
        this.getLocation();
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_vendor.t($data.locationText),
    b: $data.loading ? 1 : "",
    c: common_vendor.o((...args) => $options.handleLocationClick && $options.handleLocationClick(...args))
  };
}
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-1c8da91f"]]);
wx.createComponent(Component);
//# sourceMappingURL=../../.sourcemap/mp-weixin/components/LocationBar.js.map
