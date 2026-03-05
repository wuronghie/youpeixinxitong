"use strict";
const common_vendor = require("../../common/vendor.js");
const dbCollectionName = "teacher-profiles";
const pageSize = 20;
const pageCurrent = 1;
const _sfc_main = {
  data() {
    return {
      collectionList: dbCollectionName,
      query: "",
      where: "",
      orderby: "",
      dataList: [],
      loading: false,
      page: pageCurrent,
      pageSize,
      hasMore: true
    };
  },
  onLoad() {
    this.loadData();
  },
  methods: {
    getWhere() {
      const query = this.query.trim();
      if (!query) {
        return "";
      }
      const db = common_vendor.tr.database();
      const dbCmd = db.command;
      return dbCmd.or([
        { display_name: new RegExp(query, "i") },
        { teacher_id: new RegExp(query, "i") }
      ]);
    },
    search() {
      const newWhere = this.getWhere();
      this.where = newWhere;
      this.page = 1;
      this.hasMore = true;
      this.dataList = [];
      this.loadData();
    },
    loadMore() {
      if (this.loading || !this.hasMore)
        return;
      this.page += 1;
      this.loadData(false);
    },
    loadData(clear = true) {
      if (this.loading)
        return;
      this.loading = true;
      const db = common_vendor.tr.database();
      let query = db.collection(this.collectionList);
      if (this.where) {
        query = query.where(this.where);
      }
      if (this.orderby) {
        query = query.orderBy(this.orderby);
      }
      query.skip((this.page - 1) * this.pageSize).limit(this.pageSize).get().then((res) => {
        const data = res.result.data || [];
        if (clear) {
          this.dataList = data;
        } else {
          this.dataList = [...this.dataList, ...data];
        }
        this.hasMore = data.length === this.pageSize;
      }).catch((err) => {
        common_vendor.index.__f__("error", "at pages/teacher-profiles/list.vue:173", "加载数据失败:", err);
        common_vendor.index.showToast({ title: "加载失败", icon: "none" });
      }).finally(() => {
        this.loading = false;
      });
    },
    navigateTo(url) {
      common_vendor.index.navigateTo({
        url,
        events: {
          refreshData: () => {
            this.loadData(true);
          }
        }
      });
    },
    confirmDelete(id) {
      common_vendor.index.showModal({
        title: "确认删除",
        content: "确定要删除这条记录吗？",
        success: (res) => {
          if (res.confirm) {
            this.deleteItem(id);
          }
        }
      });
    },
    deleteItem(id) {
      const db = common_vendor.tr.database();
      db.collection(this.collectionList).doc(id).remove().then(() => {
        common_vendor.index.showToast({ title: "删除成功" });
        this.loadData(true);
      }).catch((err) => {
        common_vendor.index.showModal({
          content: err.message || "删除失败",
          showCancel: false
        });
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.search && $options.search(...args)),
    b: $data.query,
    c: common_vendor.o(($event) => $data.query = $event.detail.value),
    d: common_vendor.o((...args) => $options.search && $options.search(...args)),
    e: common_vendor.o(($event) => $options.navigateTo("./add")),
    f: common_vendor.f($data.dataList, (item, k0, i0) => {
      return common_vendor.e({
        a: item.avatar
      }, item.avatar ? {
        b: item.avatar
      } : {}, {
        c: common_vendor.t(item.display_name || "-"),
        d: item.is_verified
      }, item.is_verified ? {} : {}, {
        e: common_vendor.t(item.teacher_id || "-"),
        f: common_vendor.f((item.subjects || []).slice(0, 3), (subject, k1, i1) => {
          return {
            a: common_vendor.t(subject),
            b: subject
          };
        }),
        g: common_vendor.t(item.hourly_rate || 0),
        h: common_vendor.t(item.rating || 5),
        i: common_vendor.t(item.total_courses || 0),
        j: common_vendor.t(item.total_students || 0),
        k: common_vendor.o(($event) => $options.navigateTo("./edit?id=" + item._id), item._id),
        l: common_vendor.o(($event) => $options.confirmDelete(item._id), item._id),
        m: item._id,
        n: common_vendor.o(($event) => $options.navigateTo("./edit?id=" + item._id), item._id)
      });
    }),
    g: !$data.loading && !$data.dataList.length
  }, !$data.loading && !$data.dataList.length ? {} : {}, {
    h: $data.loading && $data.dataList.length
  }, $data.loading && $data.dataList.length ? {} : !$data.hasMore && $data.dataList.length ? {} : {}, {
    i: !$data.hasMore && $data.dataList.length,
    j: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args))
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-7937b0a1"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/teacher-profiles/list.js.map
