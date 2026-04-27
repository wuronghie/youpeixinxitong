"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_payment = require("../../utils/payment.js");
const _sfc_main = {
  data() {
    return {
      id: "",
      detail: null,
      busy: false,
      pending: null
    };
  },
  onLoad(options) {
    this.id = options.id || "";
    this.load();
  },
  methods: {
    async load() {
      if (!this.id)
        return;
      const rc = common_vendor.tr.importObject("recruitment-center", { customUI: true });
      const res = await rc.detailForTeacher({ recruitment_id: this.id });
      if (res.code !== 0) {
        common_vendor.index.showToast({ title: res.message || "加载失败", icon: "none" });
        return;
      }
      this.detail = res.data;
    },
    budgetText(row) {
      if (!row)
        return "预算可协商";
      if (row.budget_min != null || row.budget_max != null) {
        return `${row.budget_min || "待议"} - ${row.budget_max || "待议"} 元/小时`;
      }
      return "预算可协商";
    },
    locationText(row) {
      if (!row || !row.region)
        return "未填写";
      const region = row.region;
      const admin = `${region.province || ""}${region.city || ""}${region.district || ""}`.trim();
      const rawName = String(region.name || "").trim();
      let namePart = rawName;
      let addrPart = "";
      const sep = " · ";
      if (rawName.includes(sep)) {
        const idx = rawName.indexOf(sep);
        namePart = rawName.slice(0, idx).trim();
        addrPart = rawName.slice(idx + sep.length).trim();
      }
      if (addrPart) {
        if (admin && addrPart.startsWith(admin))
          return addrPart;
        return `${admin}${addrPart}`.trim() || addrPart;
      }
      if (rawName) {
        if (admin && rawName.startsWith(admin))
          return rawName;
        if (admin && namePart && !rawName.includes(namePart))
          return `${admin}${namePart}`.trim();
        if (admin && namePart && rawName === namePart)
          return `${admin}${namePart}`.trim();
        if (rawName)
          return rawName;
      }
      return admin || "未填写";
    },
    studentGenderText(gender) {
      if (gender === "male" || gender === 1 || gender === "1")
        return "男孩";
      if (gender === "female" || gender === 2 || gender === "2")
        return "女孩";
      return "";
    },
    goChat(conversationId, appointmentId) {
      if (!conversationId) {
        common_vendor.index.showToast({ title: "未找到会话", icon: "none" });
        return;
      }
      const query = [
        `conversationId=${encodeURIComponent(conversationId)}`,
        `appointmentId=${encodeURIComponent(appointmentId || "")}`,
        "inviteSource=recruitment"
      ].join("&");
      common_vendor.index.navigateTo({
        url: `/pages-teacher/chat/conversation?${query}`
      });
    },
    async ensureDepositBeforeChat(appointmentId) {
      if (!appointmentId) {
        common_vendor.index.showToast({ title: "未找到预约信息", icon: "none" });
        return false;
      }
      const payResult = await utils_payment.createAndPay({
        appointment_id: appointmentId,
        payment_type: "deposit",
        amount: 100
      });
      if (payResult.code !== 0) {
        common_vendor.index.showToast({ title: payResult.message || "支付未完成", icon: "none" });
        return false;
      }
      return true;
    },
    async onInvite() {
      if (this.busy || !this.id)
        return;
      this.busy = true;
      try {
        const rc = common_vendor.tr.importObject("recruitment-center", { customUI: true });
        const res = await rc.inviteFromRecruitment({ recruitment_id: this.id });
        if (res.code !== 0) {
          common_vendor.index.showToast({ title: res.message || "失败", icon: "none" });
          return;
        }
        if (res.data.need_deposit) {
          const ok = await this.ensureDepositBeforeChat(res.data.appointment_id);
          if (!ok)
            return;
        }
        this.goChat(res.data.conversation_id, res.data.appointment_id);
        await this.load();
      } catch (e) {
        common_vendor.index.showToast({ title: e.message || "失败", icon: "none" });
      } finally {
        this.busy = false;
      }
    },
    async onContinue() {
      if (this.busy || !this.detail)
        return;
      this.busy = true;
      try {
        const mr = this.detail.my_response;
        if (!mr || !mr.appointment_id || !mr.conversation_id) {
          common_vendor.index.showToast({ title: "数据异常", icon: "none" });
          return;
        }
        if (this.detail.need_deposit) {
          const ok = await this.ensureDepositBeforeChat(mr.appointment_id);
          if (!ok)
            return;
        }
        this.goChat(mr.conversation_id, mr.appointment_id);
      } catch (e) {
        common_vendor.index.showToast({ title: e.message || "失败", icon: "none" });
      } finally {
        this.busy = false;
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: $data.detail
  }, $data.detail ? common_vendor.e({
    b: common_vendor.t($data.detail.display_name),
    c: common_vendor.t($data.detail.subject),
    d: common_vendor.t($data.detail.student_grade),
    e: $options.studentGenderText($data.detail.student_gender)
  }, $options.studentGenderText($data.detail.student_gender) ? {
    f: common_vendor.t($options.studentGenderText($data.detail.student_gender))
  } : {}, {
    g: common_vendor.t($data.detail.lesson_mode === "online" ? "线上" : "线下"),
    h: common_vendor.t($data.detail.already_responded ? "已响应" : "可邀请"),
    i: common_vendor.t($data.detail.lesson_mode === "online" ? "线上辅导" : "线下辅导"),
    j: $data.detail.lesson_mode === "offline" && $options.locationText($data.detail) !== "未填写"
  }, $data.detail.lesson_mode === "offline" && $options.locationText($data.detail) !== "未填写" ? {
    k: common_vendor.t($options.locationText($data.detail))
  } : {}, {
    l: common_vendor.t($options.budgetText($data.detail)),
    m: common_vendor.t($options.locationText($data.detail)),
    n: common_vendor.t($data.detail.time_note || "暂未指定，可进一步沟通"),
    o: common_vendor.t($options.studentGenderText($data.detail.student_gender) || "未填写"),
    p: common_vendor.t($data.detail.goal || "家长暂未填写"),
    q: common_vendor.t($data.detail.remark || "暂无补充说明")
  }) : {}, {
    r: $data.detail
  }, $data.detail ? common_vendor.e({
    s: common_vendor.t($data.detail.already_responded ? "继续跟进此需求" : "先建立联系，再进入聊天发送试课邀请"),
    t: common_vendor.t($data.detail.need_deposit ? "若你还未向该家长支付信息费，需要先完成支付后才能进入聊天。" : $data.detail.already_responded ? "如果之前已经发过试课邀请，聊天页不会重复发送。" : "首次进入会自动建立会话与预约记录，试课邀请在聊天页发送。"),
    v: !$data.detail.already_responded
  }, !$data.detail.already_responded ? {
    w: common_vendor.t($data.busy ? "处理中..." : $data.detail.need_deposit ? "支付信息费并进入聊天" : "进入聊天"),
    x: $data.busy,
    y: common_vendor.o((...args) => $options.onInvite && $options.onInvite(...args))
  } : {
    z: common_vendor.t($data.busy ? "处理中..." : $data.detail.need_deposit ? "支付信息费并进入聊天" : "进入聊天"),
    A: $data.busy,
    B: common_vendor.o((...args) => $options.onContinue && $options.onContinue(...args))
  }) : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-29793447"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages-teacher/recruitment/detail.js.map
