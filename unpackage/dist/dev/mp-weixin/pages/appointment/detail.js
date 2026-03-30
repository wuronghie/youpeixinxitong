"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const utils_payment = require("../../utils/payment.js");
const card = () => "../../components/common/card.js";
const divider = () => "../../components/common/divider.js";
const _sfc_main = {
  name: "AppointmentDetail",
  components: {
    card,
    divider
  },
  data() {
    return {
      appointmentId: "",
      appointment: {},
      // 优惠券相关
      availableCoupons: [],
      couponPreview: null,
      // 试算结果：originalAmount / discountAmount / payableAmount 等
      couponLoading: false,
      isLoading: false,
      isRefreshing: false,
      scrollTop: 0,
      canRefresh: true,
      // 默认头像URL（从CDN）
      defaultAvatarUrl: utils_imageConfig.getDefaultAvatarUrl()
    };
  },
  onLoad(options) {
    this.appointmentId = options.id || "";
    if (!this.appointmentId) {
      common_vendor.index.showToast({ title: "预约ID不能为空", icon: "none" });
      setTimeout(() => common_vendor.index.navigateBack(), 1500);
      return;
    }
    this.loadDetail();
  },
  // 从其他页面返回（例如提交评价后）时刷新一次详情，确保状态最新
  onShow() {
    if (this.appointmentId) {
      this.loadDetail();
    }
  },
  computed: {
    statusTip() {
      const map = {
        pending_payment: "请尽快完成课程费用支付，确认预约信息",
        pending_confirm: "老师正在确认中，稍后请留意消息",
        confirmed: "预约已确认，等待上课",
        in_progress: "课程进行中，如有变更请及时联系老师",
        completed: "课程已完成，欢迎给予评价",
        rejected: "预约已被教师拒绝，课程费用将原路退回",
        cancelled: "预约已取消，可重新选择老师",
        refunding: "退款申请处理中，请耐心等待平台或教师处理",
        refunded: "预约已退款，资金将在 1-3 个工作日内退回"
      };
      return map[this.appointment.status] || "";
    },
    canConfirmCompletion() {
      if (!this.appointment || !this.appointment.parent_paid) {
        return false;
      }
      if (this.appointment.has_review) {
        return false;
      }
      const allowStatuses = ["pending_confirm", "confirmed", "in_progress"];
      return allowStatuses.includes(this.appointment.status);
    },
    canPayCourse() {
      if (!this.appointment || this.appointment.parent_paid) {
        return false;
      }
      const allowStatuses = ["confirmed"];
      return allowStatuses.includes(this.appointment.status);
    },
    // 是否有可用优惠券（根据列表和金额动态判断）
    canUseCoupon() {
      if (!this.appointment)
        return false;
      const amount = Number(this.appointment.amount || 0);
      if (!amount)
        return false;
      if (!this.availableCoupons || this.availableCoupons.length === 0)
        return false;
      return this.availableCoupons.some((c) => {
        const min = Number(c.min_spend || 0);
        return !min || amount >= min;
      });
    },
    // 实际应付金额（考虑优惠券）
    payableAmount() {
      var _a;
      const base = Number(((_a = this.appointment) == null ? void 0 : _a.amount) || 0);
      if (!this.couponPreview)
        return base;
      const pRaw = this.couponPreview.payableAmount;
      const p = Number(pRaw);
      if (pRaw === void 0 || pRaw === null || Number.isNaN(p))
        return base;
      return p;
    },
    // 优惠金额
    couponDiscountAmount() {
      var _a;
      const base = Number(((_a = this.appointment) == null ? void 0 : _a.amount) || 0);
      const pay = Number(this.payableAmount);
      if (!base || Number.isNaN(pay) || pay < 0)
        return 0;
      const diff = base - pay;
      return diff > 0 ? diff : 0;
    },
    // 费用区块里优惠券行的展示文案
    couponDisplayText() {
      if (!this.canUseCoupon) {
        return "暂无可用优惠券";
      }
      if (this.couponPreview && this.couponPreview.couponName) {
        const discount = Number(this.couponDiscountAmount || 0);
        if (discount > 0) {
          return `${this.couponPreview.couponName} 已减¥${discount.toFixed(2)}`;
        }
        return this.couponPreview.couponName;
      }
      return "请选择优惠券";
    },
    canRefund() {
      if (!this.appointment || !this.appointment.parent_paid) {
        return false;
      }
      if (this.appointment.has_review) {
        return false;
      }
      if (this.appointment.course_type === "trial" && ["confirmed", "in_progress"].includes(this.appointment.status)) {
        return false;
      }
      const allowStatuses = ["pending_confirm", "confirmed", "in_progress", "completed"];
      const disallowStatuses = ["refunding", "refunded", "cancelled", "rejected"];
      return allowStatuses.includes(this.appointment.status) && !disallowStatuses.includes(this.appointment.status);
    },
    payButtonText() {
      return "支付课程费";
    },
    canTrialRefund() {
      if (!this.appointment || this.appointment.course_type !== "trial") {
        return false;
      }
      if (!this.appointment.parent_paid) {
        return false;
      }
      if (this.appointment.has_review) {
        return false;
      }
      const allowStatuses = ["confirmed", "in_progress"];
      return allowStatuses.includes(this.appointment.status);
    },
    hasActionButtons() {
      return this.canPayCourse || this.appointment.status === "pending_confirm" || this.canConfirmCompletion || this.appointment.status === "completed" && !this.appointment.has_review || this.canRefund;
    }
  },
  methods: {
    async loadDetail() {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      if (this.isLoading)
        return;
      this.isLoading = true;
      const currentParentPaid = (_a = this.appointment) == null ? void 0 : _a.parent_paid;
      const currentStatus = (_b = this.appointment) == null ? void 0 : _b.status;
      try {
        const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
        const res = await appointmentQuery.getAppointmentDetail({ appointment_id: this.appointmentId });
        if (res.code === 0 && res.data) {
          const data = res.data;
          this.appointment = {
            _id: data._id,
            appointment_no: data.appointment_no,
            teacher_name: ((_c = data.teacher_info) == null ? void 0 : _c.display_name) || ((_d = data.teacher_info) == null ? void 0 : _d.name),
            teacher_avatar: (_e = data.teacher_info) == null ? void 0 : _e.avatar,
            teacher_verified: (_f = data.teacher_info) == null ? void 0 : _f.is_verified,
            subject: data.subject,
            date: data.date || data.appointment_date,
            time: data.start_time || data.appointment_time,
            duration: data.duration,
            amount: data.total_amount || data.total_fee,
            houry_rate: (_g = data.teacher_info) == null ? void 0 : _g.hourly_rate,
            hourly_rate: (_h = data.teacher_info) == null ? void 0 : _h.hourly_rate,
            address: this.formatAddress(data.lesson_mode, data.address),
            status: data.status,
            course_type: data.course_type,
            student_name: ((_i = data.student_info) == null ? void 0 : _i.name) || data.student_name,
            student_grade: ((_j = data.student_info) == null ? void 0 : _j.grade) || data.student_grade,
            requirements: data.requirements,
            lesson_mode: data.lesson_mode,
            // 评价状态（用于控制“退款”和“发表评价”按钮）
            has_review: !!data.has_review,
            // 如果本地已标记为已支付，保留状态（云服务可能还没更新）
            parent_paid: currentParentPaid || !!data.parent_paid,
            deposit_paid: !!data.deposit_paid,
            // 流程进度不再显示，但保留数据以防其他地方使用
            flow: this.buildFlow(data),
            conversation_id: data.conversation_id
          };
          if (currentParentPaid && !data.parent_paid) {
            this.appointment.parent_paid = true;
            if (currentStatus === "pending_payment") {
              this.appointment.status = "pending_confirm";
            }
          }
        } else {
          throw new Error(res.message || "获取预约详情失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/appointment/detail.vue:424", "获取预约详情失败:", error);
        if (currentParentPaid && this.appointment) {
          this.appointment.parent_paid = currentParentPaid;
          if (currentStatus) {
            this.appointment.status = currentStatus;
          }
        }
        if (!error.message || !error.message.includes("云服务")) {
          common_vendor.index.showToast({ title: error.message || "获取详情失败", icon: "none" });
        }
      } finally {
        this.isLoading = false;
        this.isRefreshing = false;
      }
    },
    handleScroll(e) {
      this.scrollTop = e.detail.scrollTop;
      this.canRefresh = e.detail.scrollTop <= 10;
    },
    handleScrollToUpper() {
      this.scrollTop = 0;
      this.canRefresh = true;
    },
    onRefresh() {
      if (!this.canRefresh || this.scrollTop > 10) {
        this.isRefreshing = false;
        return;
      }
      if (this.isRefreshing)
        return;
      this.isRefreshing = true;
      this.loadDetail();
    },
    formatStatus(status) {
      const map = {
        pending_payment: "待支付",
        pending_confirm: "待确认",
        contact_request: "待确认",
        confirmed: "已确认",
        in_progress: "进行中",
        completed: "已完成",
        rejected: "已取消",
        cancelled: "已取消",
        refunding: "退款处理中",
        refunded: "已退款"
      };
      return map[status] || "未知状态";
    },
    formatCourseType(type) {
      return type === "regular" ? "正式课程" : "试课体验";
    },
    formatAddress(mode, address) {
      if (mode === "online")
        return "线上授课";
      if (!address)
        return "待确认";
      if (typeof address === "string") {
        return this.removeDuplicateAddress(address);
      }
      if (typeof address === "object") {
        if (address.name && String(address.name).trim()) {
          return this.removeDuplicateAddress(String(address.name).trim());
        }
        if (address.full || address.address) {
          const fullAddr = address.full || address.address;
          return this.removeDuplicateAddress(fullAddr);
        }
        const detail = address.detail || "";
        const province = address.province || "";
        const city = address.city || "";
        const district = address.district || "";
        if (detail) {
          const hasProvince = province && detail.includes(province);
          const hasCity = city && detail.includes(city);
          const hasDistrict = district && detail.includes(district);
          if (hasProvince || hasCity && hasDistrict) {
            return this.removeDuplicateAddress(detail);
          }
        }
        const parts = [];
        if (province)
          parts.push(province);
        if (city && city !== province)
          parts.push(city);
        if (district && district !== city && district !== province)
          parts.push(district);
        if (detail) {
          const hasAnyPart = parts.some((part) => detail.includes(part));
          if (!hasAnyPart) {
            parts.push(detail);
          }
        }
        return parts.join(" ");
      }
      return "待确认";
    },
    // 去除地址字符串中的重复内容（专门处理旧数据中的重复问题）
    removeDuplicateAddress(addressStr) {
      if (!addressStr || typeof addressStr !== "string")
        return addressStr;
      let result = addressStr.trim();
      if (result.length < 10)
        return result;
      result = result.replace(/([省市县区街道镇乡])\1+/g, "$1");
      const mid = Math.floor(result.length / 2);
      const firstHalf = result.substring(0, mid);
      const secondHalf = result.substring(mid);
      if (firstHalf === secondHalf) {
        return firstHalf.trim();
      }
      if (firstHalf.length >= 5 && secondHalf.includes(firstHalf)) {
        const index = secondHalf.indexOf(firstHalf);
        if (index === 0) {
          return firstHalf.trim();
        } else {
          return (firstHalf + secondHalf.substring(0, index) + secondHalf.substring(index + firstHalf.length)).trim();
        }
      }
      for (let len = Math.min(25, Math.floor(result.length / 2)); len >= 4; len--) {
        const pattern = new RegExp(`(.{${len}})(\\1)+`, "g");
        let changed = false;
        result = result.replace(pattern, (match, segment) => {
          changed = true;
          return segment;
        });
        if (changed) {
          len = Math.min(25, Math.floor(result.length / 2)) + 1;
          result = result.replace(/([省市县区街道镇乡])\1+/g, "$1");
        }
      }
      const duplicatePattern = /^(.+?)(省|市|区|县|街道|镇|乡)(.+?)(省|市|区|县|街道|镇|乡)(.+?)(省|市|区|县|街道|镇|乡)(\1\2\3\4\5\6)/g;
      result = result.replace(duplicatePattern, "$1$2$3$4$5$6");
      result = result.replace(/([省市县区街道镇乡])\1+/g, "$1").replace(/\s+/g, "").trim();
      return result || addressStr;
    },
    buildFlow(data) {
      const steps = [
        { key: "created", title: "提交预约", time: this.formatTime(data.create_time), active: true },
        { key: "parent_pay", title: "家长支付课程费", time: data.parent_paid ? this.formatTime(data.parent_payment_time || data.payment_time) : "", active: !!data.parent_paid },
        { key: "deposit", title: "教师支付保证金", time: data.deposit_paid ? this.formatTime(data.deposit_time) : "", active: !!data.deposit_paid },
        { key: "confirm", title: "教师确认", time: data.status !== "pending_confirm" ? this.formatTime(data.confirm_time) : "", active: ["confirmed", "in_progress", "completed"].includes(data.status) },
        { key: "finished", title: "课程完成", time: data.status === "completed" ? this.formatTime(data.complete_time) : "", active: data.status === "completed" }
      ];
      return steps;
    },
    formatTime(ts) {
      if (!ts)
        return "";
      const date = new Date(ts);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hour = String(date.getHours()).padStart(2, "0");
      const minute = String(date.getMinutes()).padStart(2, "0");
      return `${month}-${day} ${hour}:${minute}`;
    },
    // 打开优惠券选择
    async openCouponSelector() {
      if (!this.canPayCourse)
        return;
      if (!this.appointmentId) {
        common_vendor.index.showToast({ title: "预约信息异常", icon: "none" });
        return;
      }
      if (this.couponLoading)
        return;
      const amount = Number(this.appointment.amount || 0);
      if (!amount) {
        common_vendor.index.showToast({ title: "课程金额异常，无法使用优惠券", icon: "none" });
        return;
      }
      try {
        this.couponLoading = true;
        if (!this.availableCoupons || this.availableCoupons.length === 0) {
          const couponCenter = common_vendor.tr.importObject("coupon-center", { customUI: true });
          const res = await couponCenter.getAvailableCoupons();
          if (res.code === 0 && res.data && Array.isArray(res.data.list)) {
            this.availableCoupons = res.data.list;
          } else {
            this.availableCoupons = [];
          }
        }
        if (!this.canUseCoupon) {
          common_vendor.index.showToast({ title: "暂无可用优惠券", icon: "none" });
          return;
        }
        const usableCoupons = this.availableCoupons.filter((c) => {
          const min = Number(c.min_spend || 0);
          return !min || amount >= min;
        });
        if (!usableCoupons.length) {
          common_vendor.index.showToast({ title: "当前金额未达到优惠券使用门槛", icon: "none" });
          return;
        }
        const itemList = ["不使用优惠券", ...usableCoupons.map((c) => {
          const min = Number(c.min_spend || 0);
          const title = c.type === "amount" ? `减¥${Number(c.amount || 0).toFixed(2)}` : `${Number(c.discount * 10 || 0).toFixed(1)}折`;
          const minText = min > 0 ? `（满¥${min.toFixed(2)}可用）` : "";
          return `${c.name || "优惠券"} ${title}${minText}`;
        })];
        common_vendor.index.showActionSheet({
          itemList,
          success: async (res) => {
            const index = res.tapIndex;
            if (index === 0) {
              this.couponPreview = null;
              return;
            }
            const couponRecord = usableCoupons[index - 1];
            if (!couponRecord)
              return;
            try {
              const couponCenter = common_vendor.tr.importObject("coupon-center", { customUI: true });
              const previewRes = await couponCenter.previewForAppointment({
                appointment_id: this.appointmentId,
                user_coupon_id: couponRecord._id
              });
              if (previewRes.code === 0 && previewRes.data) {
                this.couponPreview = {
                  ...previewRes.data,
                  couponName: couponRecord.name || previewRes.data.couponName
                };
              } else {
                common_vendor.index.showToast({ title: previewRes.message || "优惠券不可用", icon: "none" });
              }
            } catch (e) {
              common_vendor.index.__f__("error", "at pages/appointment/detail.vue:685", "试算优惠券失败:", e);
              common_vendor.index.showToast({ title: "优惠券试算失败，请稍后重试", icon: "none" });
            }
          }
        });
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/appointment/detail.vue:691", "打开优惠券选择失败:", error);
        common_vendor.index.showToast({ title: "加载优惠券失败", icon: "none" });
      } finally {
        this.couponLoading = false;
      }
    },
    async handlePay() {
      if (!this.appointmentId)
        return;
      const baseAmount = Number(this.appointment.amount || 0);
      const hasCouponPreview = !!this.couponPreview;
      const rawPayable = hasCouponPreview ? this.payableAmount : baseAmount;
      const amount = Number(rawPayable);
      if (Number.isNaN(amount) || amount < 0) {
        common_vendor.index.showToast({ title: "课程金额异常，无法支付", icon: "none" });
        return;
      }
      const discount = Number(this.couponDiscountAmount || 0);
      let content = "";
      if (discount > 0) {
        content = `课程原价：¥${baseAmount.toFixed(2)}
优惠券减免：-¥${discount.toFixed(2)}
实付金额：¥${amount.toFixed(2)}

确认支付？试课满意后可继续安排正式课程。`;
      } else {
        content = `确认支付 ¥${amount.toFixed(2)} 课程费用？试课满意后可继续安排正式课程。`;
      }
      common_vendor.index.showModal({
        title: "支付课程费用",
        content,
        success: async (res) => {
          var _a;
          if (!res.confirm)
            return;
          common_vendor.index.showLoading({ title: "创建订单中...", mask: true });
          try {
            const amountInCents = Math.round(amount * 100);
            const userCouponId = this.couponPreview ? this.couponPreview.user_coupon_id : null;
            if (amountInCents === 0) {
              const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
              const createRes = await paymentCreate.create({
                appointment_id: this.appointmentId,
                payment_type: "course_fee",
                amount: 0,
                user_coupon_id: userCouponId
              });
              if (createRes.code !== 0 || !createRes.data || !createRes.data.order_no) {
                throw new Error(createRes.message || "创建支付订单失败");
              }
              const payRes = await paymentCreate.mockPaySuccess({
                order_no: createRes.data.order_no
              });
              if (payRes.code === 0) {
                if (this.appointment) {
                  this.appointment.parent_paid = true;
                  this.appointment.status = ((_a = payRes.data) == null ? void 0 : _a.appointment_status) || "pending_confirm";
                }
                common_vendor.index.hideLoading();
                common_vendor.index.showToast({
                  title: "支付成功，等待老师确认",
                  icon: "success",
                  duration: 2e3
                });
                setTimeout(() => {
                  this.loadDetail();
                }, 1e3);
              } else {
                common_vendor.index.hideLoading();
                throw new Error(payRes.message || "支付失败");
              }
              return;
            }
            const payComponent = this.$refs.pay;
            if (payComponent && typeof payComponent.open === "function") {
              common_vendor.index.hideLoading();
              try {
                await utils_payment.createAndPayWithUniPay(payComponent, {
                  appointment_id: this.appointmentId,
                  payment_type: "course_fee",
                  amount: amountInCents,
                  description: "支付课程费用",
                  user_coupon_id: userCouponId
                });
                return;
              } catch (error) {
                common_vendor.index.__f__("warn", "at pages/appointment/detail.vue:792", "uni-pay 组件调用失败，降级到模拟支付:", error);
              }
            }
            common_vendor.index.hideLoading();
            const payResult = await utils_payment.createAndPay({
              appointment_id: this.appointmentId,
              payment_type: "course_fee",
              amount: amountInCents,
              user_coupon_id: userCouponId
            });
            if (payResult.code === 0) {
              if (this.appointment) {
                this.appointment.parent_paid = true;
                this.appointment.status = this.appointment.status === "pending_payment" ? "pending_confirm" : this.appointment.status;
              }
              common_vendor.index.showToast({
                title: "支付成功，等待老师确认",
                icon: "success",
                duration: 2e3
              });
              setTimeout(() => {
                this.loadDetail();
              }, 1e3);
            } else {
              if (payResult.message && !payResult.message.includes("取消")) {
                common_vendor.index.showToast({
                  title: payResult.message || "支付失败",
                  icon: "none",
                  duration: 2e3
                });
              }
            }
          } catch (error) {
            common_vendor.index.hideLoading();
            common_vendor.index.__f__("error", "at pages/appointment/detail.vue:832", "支付课程费失败:", error);
            common_vendor.index.showToast({
              title: error.message || "支付失败，请稍后重试",
              icon: "none",
              duration: 2e3
            });
          }
        }
      });
    },
    // uni-pay 组件事件：订单创建成功
    onPayCreate(res) {
      common_vendor.index.__f__("log", "at pages/appointment/detail.vue:844", "支付订单创建成功:", res);
    },
    // uni-pay 组件事件：支付成功
    async onPaySuccess(res) {
      var _a, _b, _c;
      common_vendor.index.__f__("log", "at pages/appointment/detail.vue:848", "[支付成功] uni-pay 回调:", res);
      const isPaid = res.has_paid || res.status === 1 || res.user_order_success;
      if (!isPaid) {
        common_vendor.index.__f__("warn", "at pages/appointment/detail.vue:853", "[支付成功] 支付成功事件但状态异常:", res);
        return;
      }
      const order_no = res.order_no || ((_a = res.pay_order) == null ? void 0 : _a.order_no);
      const out_trade_no = res.out_trade_no;
      const custom = res.custom || {};
      const order_id = custom.order_id;
      common_vendor.index.__f__("log", "at pages/appointment/detail.vue:863", "[支付成功] 订单信息:", {
        order_no,
        out_trade_no,
        order_id,
        appointment_id: custom.appointment_id
      });
      try {
        const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
        let finalOrderNo = order_no;
        if (!finalOrderNo) {
          common_vendor.index.__f__("log", "at pages/appointment/detail.vue:878", "[支付成功] 未找到 order_no，通过 appointment_id 查找订单...");
          const orderListRes = await paymentCreate.getOrderList({
            appointment_id: this.appointmentId || custom.appointment_id,
            payment_type: "course_fee",
            status: "all",
            page: 1,
            pageSize: 1
          });
          if (orderListRes.code === 0 && orderListRes.data && orderListRes.data.list && orderListRes.data.list.length > 0) {
            finalOrderNo = orderListRes.data.list[0].order_no;
            common_vendor.index.__f__("log", "at pages/appointment/detail.vue:889", "[支付成功] 找到订单:", finalOrderNo);
          }
        }
        if (!finalOrderNo) {
          throw new Error("无法获取订单号，请稍后刷新页面查看支付状态");
        }
        common_vendor.index.__f__("log", "at pages/appointment/detail.vue:898", "[支付成功] 更新订单状态，order_no:", finalOrderNo);
        const payRes = await paymentCreate.mockPaySuccess({
          order_no: finalOrderNo,
          out_trade_no,
          // 传递 out_trade_no，供退款时使用
          uni_pay_order_no: order_no
        });
        if (payRes.code === 0) {
          common_vendor.index.__f__("log", "at pages/appointment/detail.vue:906", "[支付成功] 数据库更新成功:", {
            appointment_status: (_b = payRes.data) == null ? void 0 : _b.appointment_status,
            order_no: finalOrderNo
          });
          if (out_trade_no) {
            common_vendor.index.__f__("log", "at pages/appointment/detail.vue:913", "[支付成功] out_trade_no 已通过 mockPaySuccess 保存:", out_trade_no);
          }
          if (this.appointment) {
            this.appointment.parent_paid = true;
            this.appointment.status = ((_c = payRes.data) == null ? void 0 : _c.appointment_status) || "pending_confirm";
          }
          common_vendor.index.showToast({
            title: "支付成功，等待老师确认",
            icon: "success",
            duration: 2e3
          });
          setTimeout(() => {
            this.loadDetail();
          }, 1e3);
        } else {
          throw new Error(payRes.message || "更新预约状态失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/appointment/detail.vue:935", "[支付成功] 更新数据库失败:", error);
        if (this.appointment) {
          this.appointment.parent_paid = true;
          this.appointment.status = this.appointment.status === "pending_payment" ? "pending_confirm" : this.appointment.status;
        }
        common_vendor.index.showToast({
          title: "支付成功，等待老师确认",
          icon: "success",
          duration: 2e3
        });
        setTimeout(() => {
          this.loadDetail();
        }, 1e3);
      }
    },
    // uni-pay 组件事件：支付失败（包含用户取消）
    onPayFail(err) {
      common_vendor.index.__f__("error", "at pages/appointment/detail.vue:955", "支付失败:", err);
      const msg = err && err.errMsg ? err.errMsg : "";
      if (msg.includes("cancel")) {
        common_vendor.index.redirectTo({
          url: `/pages/payment/result?status=fail&role=parent&appointmentId=${this.appointmentId}&returnPage=/pages/appointment/detail&message=${encodeURIComponent("您已取消支付，可返回继续浏览订单")}`
        });
        return;
      }
      if (msg) {
        common_vendor.index.redirectTo({
          url: `/pages/payment/result?status=fail&role=parent&appointmentId=${this.appointmentId}&returnPage=/pages/appointment/detail&message=${encodeURIComponent(msg)}`
        });
      } else {
        common_vendor.index.showToast({
          title: "支付失败",
          icon: "none",
          duration: 2e3
        });
      }
    },
    async contactTeacher() {
      var _a, _b;
      if ((_a = this.appointment) == null ? void 0 : _a.conversation_id) {
        common_vendor.index.navigateTo({
          url: `/pages/chat/conversation?conversationId=${this.appointment.conversation_id}`
        });
        return;
      }
      try {
        common_vendor.index.showLoading({ title: "正在加载...", mask: true });
        const chatSend = common_vendor.tr.importObject("chat-send", { customUI: true });
        const res = await chatSend.getConversation({ appointment_id: this.appointmentId });
        common_vendor.index.hideLoading();
        if (res.code === 0 && ((_b = res.data) == null ? void 0 : _b.conversation_id)) {
          common_vendor.index.navigateTo({
            url: `/pages/chat/conversation?conversationId=${res.data.conversation_id}`
          });
        } else {
          common_vendor.index.showModal({
            title: "提示",
            content: res.message || "无法联系老师，请先支付课程费用",
            showCancel: false
          });
        }
      } catch (error) {
        common_vendor.index.hideLoading();
        common_vendor.index.__f__("error", "at pages/appointment/detail.vue:1008", "获取会话失败:", error);
        common_vendor.index.showToast({
          title: "无法加载聊天会话，请稍后重试",
          icon: "none"
        });
      }
    },
    createReview() {
      if (!this.appointmentId)
        return;
      common_vendor.index.navigateTo({ url: `/pages/review/create?appointmentId=${this.appointmentId}` });
    },
    async handleRefund() {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      if (!this.appointmentId)
        return;
      if (!this.appointment.parent_paid) {
        common_vendor.index.showToast({ title: "该预约尚未支付，无法申请退款", icon: "none" });
        return;
      }
      try {
        common_vendor.index.showLoading({ title: "查找订单中...", mask: true });
        common_vendor.index.__f__("log", "at pages/appointment/detail.vue:1033", "[申请退款] 开始查找订单, appointment_id:", this.appointmentId);
        const paymentCreate = common_vendor.tr.importObject("payment-create", { customUI: true });
        const orderRes = await paymentCreate.getOrderList({
          appointment_id: this.appointmentId,
          payment_type: "course_fee",
          status: "all",
          // 查询所有状态，包括 paid
          page: 1,
          pageSize: 10
        });
        common_vendor.index.__f__("log", "at pages/appointment/detail.vue:1045", "[申请退款] 方法1-云对象查询结果:", {
          code: orderRes.code,
          message: orderRes.message,
          hasData: ((_b = (_a = orderRes.data) == null ? void 0 : _a.list) == null ? void 0 : _b.length) > 0,
          listLength: (_d = (_c = orderRes.data) == null ? void 0 : _c.list) == null ? void 0 : _d.length,
          orders: (_e = orderRes.data) == null ? void 0 : _e.list
        });
        common_vendor.index.hideLoading();
        if (orderRes.code !== 0) {
          common_vendor.index.__f__("warn", "at pages/appointment/detail.vue:1056", "[申请退款] 方法1查询失败，尝试方法2");
          throw new Error(orderRes.message || "查询订单失败");
        }
        let paidOrder = null;
        if (orderRes.data && orderRes.data.list) {
          paidOrder = orderRes.data.list.find(
            (order) => order.status === "paid" || order.status === "success"
          );
          if (!paidOrder) {
            paidOrder = orderRes.data.list.find(
              (order) => order.status !== "pending" && order.status !== "unpaid" && order.status !== "cancelled"
            );
          }
          common_vendor.index.__f__("log", "at pages/appointment/detail.vue:1077", "[申请退款] 方法1-找到的订单:", paidOrder ? {
            order_id: paidOrder._id,
            order_no: paidOrder.order_no,
            status: paidOrder.status,
            amount: paidOrder.amount
          } : "无");
        }
        if (paidOrder) {
          try {
            const refundObj = common_vendor.tr.importObject("payment-refund", { customUI: true });
            const refundRes = await refundObj.getDetail({ order_id: paidOrder._id });
            if (refundRes.code === 0 && refundRes.data) {
              const refund = refundRes.data;
              common_vendor.index.__f__("log", "at pages/appointment/detail.vue:1093", "[申请退款] 已存在退款申请:", {
                refund_id: refund._id,
                status: refund.status
              });
              if (refund.status === "pending" || refund.status === "processing") {
                common_vendor.index.showModal({
                  title: "提示",
                  content: "您已提交退款申请，正在处理中",
                  showCancel: false
                });
                return;
              } else if (refund.status === "approved" || refund.status === "completed" || refund.status === "success") {
                common_vendor.index.showModal({
                  title: "提示",
                  content: "退款已完成，无法再次申请",
                  showCancel: false
                });
                return;
              }
            }
          } catch (error) {
            common_vendor.index.__f__("log", "at pages/appointment/detail.vue:1116", "[申请退款] 查询退款记录（无记录）:", error.message);
          }
          common_vendor.index.__f__("log", "at pages/appointment/detail.vue:1120", "[申请退款] 跳转到退款页面, order_id:", paidOrder._id);
          common_vendor.index.navigateTo({
            url: `/pages/order/refund?id=${paidOrder._id}`
          });
        } else {
          common_vendor.index.__f__("warn", "at pages/appointment/detail.vue:1126", "[申请退款] 方法1未找到订单，尝试方法2-直接查询数据库", {
            appointment_id: this.appointmentId,
            parent_paid: this.appointment.parent_paid,
            orders: (_f = orderRes.data) == null ? void 0 : _f.list
          });
          try {
            const db = common_vendor.tr.database();
            const directOrderRes = await db.collection("payment-orders").where({
              appointment_id: this.appointmentId,
              order_type: "course_fee"
            }).orderBy("create_time", "desc").limit(5).get();
            common_vendor.index.__f__("log", "at pages/appointment/detail.vue:1143", "[申请退款] 方法2-直接查询结果:", {
              count: ((_g = directOrderRes.data) == null ? void 0 : _g.length) || 0,
              orders: (_h = directOrderRes.data) == null ? void 0 : _h.map((o) => ({
                _id: o._id,
                order_no: o.order_no,
                status: o.status,
                payer_id: o.payer_id,
                amount: o.amount
              }))
            });
            if (directOrderRes.data && directOrderRes.data.length > 0) {
              let foundOrder = directOrderRes.data.find(
                (o) => o.status === "paid" || o.status === "success"
              );
              if (!foundOrder) {
                foundOrder = directOrderRes.data.find(
                  (o) => o.status !== "pending" && o.status !== "unpaid" && o.status !== "cancelled"
                );
              }
              if (!foundOrder) {
                foundOrder = directOrderRes.data[0];
              }
              common_vendor.index.__f__("log", "at pages/appointment/detail.vue:1168", "[申请退款] 方法2-找到订单:", {
                order_id: foundOrder._id,
                order_no: foundOrder.order_no,
                status: foundOrder.status,
                payer_id: foundOrder.payer_id
              });
              common_vendor.index.navigateTo({
                url: `/pages/order/refund?id=${foundOrder._id}`
              });
              return;
            } else {
              common_vendor.index.__f__("warn", "at pages/appointment/detail.vue:1181", "[申请退款] 方法2也未找到订单");
            }
          } catch (dbError) {
            common_vendor.index.__f__("error", "at pages/appointment/detail.vue:1184", "[申请退款] 方法2-直接查询失败:", {
              error: dbError,
              message: dbError.message
            });
          }
          common_vendor.index.showModal({
            title: "提示",
            content: `未找到对应的支付订单，无法申请退款。

预约ID: ${this.appointmentId}

可能的原因：
1. 订单尚未创建
2. 订单状态异常
3. 数据不同步

建议：
1. 刷新页面后重试
2. 联系客服处理`,
            showCancel: false
          });
        }
      } catch (error) {
        common_vendor.index.hideLoading();
        common_vendor.index.__f__("error", "at pages/appointment/detail.vue:1199", "[申请退款] 查找订单失败:", {
          error,
          message: error.message,
          appointment_id: this.appointmentId
        });
        common_vendor.index.showModal({
          title: "查找订单失败",
          content: error.message || "查找订单失败，请稍后重试。如问题持续，请联系客服。",
          showCancel: false
        });
      }
    },
    async handleTrialRefund() {
      if (!this.appointmentId)
        return;
      if (!this.appointment || this.appointment.course_type !== "trial") {
        return;
      }
      common_vendor.index.showModal({
        title: "申请退款",
        content: "确认本次试课不满意，申请退款？\n\n退款原因将默认为“试课失败”，并按照试课规则退还部分费用。",
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            const appointmentComplete = common_vendor.tr.importObject("appointment-complete", { customUI: true });
            const result = await appointmentComplete.requestRefund({
              appointment_id: this.appointmentId,
              reason: "试课失败"
            });
            if (result.code === 0) {
              common_vendor.index.showToast({ title: "退款申请已提交", icon: "success" });
              setTimeout(() => {
                this.loadDetail();
              }, 800);
            } else {
              common_vendor.index.showToast({ title: result.message || "退款申请失败", icon: "none" });
            }
          } catch (error) {
            common_vendor.index.__f__("error", "at pages/appointment/detail.vue:1239", "试课退款失败:", error);
            common_vendor.index.showToast({ title: "退款失败，请稍后重试", icon: "none" });
          }
        }
      });
    },
    handleConfirmCompletion() {
      if (!this.appointmentId) {
        common_vendor.index.showToast({ title: "未找到对应预约", icon: "none" });
        return;
      }
      common_vendor.index.showModal({
        title: "确认课程完成",
        content: "确认课程已顺利完成？确认后将开启评价。",
        success: async (res) => {
          if (!res.confirm)
            return;
          try {
            const appointmentQuery = common_vendor.tr.importObject("appointment-query", { customUI: true });
            const result = await appointmentQuery.confirmCompletion({ appointment_id: this.appointmentId });
            if (result.code === 0) {
              common_vendor.index.showToast({ title: "已确认完成", icon: "success" });
              if (this.appointment) {
                this.appointment.status = "completed";
              }
              setTimeout(() => {
                this.loadDetail();
              }, 600);
            } else {
              common_vendor.index.showToast({ title: result.message || "确认失败", icon: "none" });
            }
          } catch (error) {
            common_vendor.index.__f__("error", "at pages/appointment/detail.vue:1271", "确认课程完成失败:", error);
            common_vendor.index.showToast({ title: "确认失败，请稍后重试", icon: "none" });
          }
        }
      });
    }
  }
};
if (!Array) {
  const _component_divider = common_vendor.resolveComponent("divider");
  const _component_card = common_vendor.resolveComponent("card");
  const _easycom_uni_pay2 = common_vendor.resolveComponent("uni-pay");
  (_component_divider + _component_card + _easycom_uni_pay2)();
}
const _easycom_uni_pay = () => "../../uni_modules/uni-pay/components/uni-pay/uni-pay.js";
if (!Math) {
  _easycom_uni_pay();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.t($options.formatStatus($data.appointment.status)),
    b: common_vendor.t($options.statusTip),
    c: $data.appointment.teacher_avatar || $data.defaultAvatarUrl,
    d: common_vendor.t($data.appointment.teacher_name || "教师"),
    e: $data.appointment.teacher_verified
  }, $data.appointment.teacher_verified ? {} : {}, {
    f: common_vendor.t($data.appointment.subject || "科目待确认"),
    g: common_vendor.t($data.appointment.hourly_rate || 100),
    h: common_vendor.t($options.formatCourseType($data.appointment.course_type)),
    i: common_vendor.t($data.appointment.appointment_no || "-"),
    j: common_vendor.t($data.appointment.date),
    k: common_vendor.t($data.appointment.time),
    l: common_vendor.t($data.appointment.duration || 2),
    m: common_vendor.t($data.appointment.lesson_mode === "online" ? "线上授课" : "线下授课"),
    n: $data.appointment.lesson_mode !== "online"
  }, $data.appointment.lesson_mode !== "online" ? {
    o: common_vendor.t($data.appointment.address || "待教师确认")
  } : {}, {
    p: common_vendor.p({
      headTitle: "预约信息",
      bodyPadding: true
    }),
    q: common_vendor.t($data.appointment.student_name || "未填写"),
    r: common_vendor.t($data.appointment.student_grade || "未填写"),
    s: common_vendor.t($data.appointment.requirements || "暂无"),
    t: common_vendor.p({
      headTitle: "学生信息",
      bodyPadding: true
    }),
    v: common_vendor.t(Number($data.appointment.amount || 0).toFixed(2)),
    w: $options.canPayCourse
  }, $options.canPayCourse ? {
    x: common_vendor.t($options.couponDisplayText),
    y: common_vendor.n($options.canUseCoupon ? "main-text-color" : "text-light-muted"),
    z: common_vendor.o((...args) => $options.openCouponSelector && $options.openCouponSelector(...args))
  } : {}, {
    A: $options.couponDiscountAmount > 0
  }, $options.couponDiscountAmount > 0 ? {
    B: common_vendor.t(Number($options.couponDiscountAmount || 0).toFixed(2))
  } : {}, {
    C: $options.couponDiscountAmount > 0
  }, $options.couponDiscountAmount > 0 ? {
    D: common_vendor.t(Number($options.payableAmount || 0).toFixed(2))
  } : {}, {
    E: $data.appointment.course_type === "trial"
  }, $data.appointment.course_type === "trial" ? {} : {}, {
    F: common_vendor.p({
      headTitle: "费用信息",
      bodyPadding: true
    }),
    G: $options.hasActionButtons
  }, $options.hasActionButtons ? {} : {}, {
    H: $options.hasActionButtons
  }, $options.hasActionButtons ? common_vendor.e({
    I: $options.canPayCourse
  }, $options.canPayCourse ? {
    J: common_vendor.t($options.payButtonText),
    K: common_vendor.o((...args) => $options.handlePay && $options.handlePay(...args))
  } : {}, {
    L: !$options.canPayCourse && $options.canConfirmCompletion
  }, !$options.canPayCourse && $options.canConfirmCompletion ? {
    M: common_vendor.o((...args) => $options.handleConfirmCompletion && $options.handleConfirmCompletion(...args))
  } : {}, {
    N: $options.canTrialRefund
  }, $options.canTrialRefund ? {
    O: common_vendor.o((...args) => $options.handleTrialRefund && $options.handleTrialRefund(...args))
  } : {}, {
    P: !$options.canTrialRefund && $options.canRefund
  }, !$options.canTrialRefund && $options.canRefund ? {
    Q: common_vendor.o((...args) => $options.handleRefund && $options.handleRefund(...args))
  } : {}, {
    R: $data.appointment.status === "completed" && !$data.appointment.has_review
  }, $data.appointment.status === "completed" && !$data.appointment.has_review ? {
    S: common_vendor.o((...args) => $options.createReview && $options.createReview(...args))
  } : {}, {
    T: $data.appointment.status === "pending_confirm" && !$options.canPayCourse && !$data.appointment.parent_paid
  }, $data.appointment.status === "pending_confirm" && !$options.canPayCourse && !$data.appointment.parent_paid ? {
    U: common_vendor.o((...args) => $options.contactTeacher && $options.contactTeacher(...args))
  } : {}) : {}, {
    V: common_vendor.sr("pay", "1578feaf-7"),
    W: common_vendor.o($options.onPaySuccess),
    X: common_vendor.o($options.onPayCreate),
    Y: common_vendor.o($options.onPayFail),
    Z: common_vendor.p({
      height: "70vh",
      ["to-success-page"]: false,
      ["return-url"]: "/pages/appointment/detail",
      logo: "/static/logo.png"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-1578feaf"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/appointment/detail.js.map
