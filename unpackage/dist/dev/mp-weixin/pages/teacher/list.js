"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_mockData = require("../../utils/mockData.js");
const utils_pullRefreshMixin = require("../../utils/pullRefreshMixin.js");
const utils_imageConfig = require("../../utils/imageConfig.js");
const ParentTabBar = () => "../../components/ParentTabBar.js";
const LocationBar = () => "../../components/LocationBar.js";
const _sfc_main = {
  name: "TeacherList",
  mixins: [utils_pullRefreshMixin.pullRefreshMixin],
  components: {
    ParentTabBar,
    LocationBar
  },
  data() {
    return {
      // 默认头像URL（从CDN）
      defaultAvatarUrl: utils_imageConfig.getDefaultAvatarUrl(),
      // 收藏图标URL（从CDN）
      favoriteFilledUrl: utils_imageConfig.getIconUrl("favorite-filled.png"),
      favoriteEmptyUrl: utils_imageConfig.getIconUrl("favorite-empty.png"),
      // 搜索关键词
      searchKeyword: "",
      // 教师列表数据
      teacherList: [],
      // 是否正在加载（首次加载）
      isLoading: false,
      // 是否正在刷新（下拉刷新）
      isRefreshing: false,
      // 是否正在加载更多（上拉加载）
      loadingMore: false,
      // 当前页码
      currentPage: 1,
      // 每页数据量
      pageSize: 10,
      // 是否还有更多数据
      hasMore: true,
      // 选中的科目筛选（空字符串表示全部）
      selectedSubject: "",
      // 选中的年级筛选（空字符串表示全部）
      selectedGrade: "",
      // 选中的排序方式：'rating'(智能推荐)、'newest'(人气优先)、'price_asc'(价格从低到高)、'price'(价格从高到低)
      selectedSort: "rating",
      // 已收藏的教师ID列表（用于显示收藏状态）
      favoriteIds: [],
      // 收藏操作是否进行中（防止重复点击）
      favoriteLoading: false,
      // 是否使用模拟数据（开发测试用）
      useMock: false,
      // 用户位置（用于计算与教师距离）
      userLocation: null,
      // 滚动位置（用于下拉刷新判断）
      scrollTop: 0,
      // 是否可以刷新（滚动位置在顶部时才能刷新）
      canRefresh: true,
      // 筛选分类展开/收起状态
      filterSectionsExpanded: {
        subject: true,
        // 科目分类是否展开
        grade: true,
        // 年级分类是否展开
        school: false,
        // 院校分类是否展开
        experience: false,
        // 资历分类是否展开
        price: false,
        // 价格分类是否展开
        location: false,
        // 位置分类是否展开
        tags: false,
        // 标签分类是否展开
        sort: true
        // 排序分类是否展开
      },
      // 选中的筛选值
      selectedSchool: "",
      // 选中的院校
      selectedExperience: "",
      // 选中的资历
      selectedPrice: "",
      // 选中的价格区间
      selectedLocation: "",
      // 选中的位置
      selectedTags: [],
      // 选中的标签（多选）
      // 科目筛选选项
      // 修改提示：科目列表与数据库 teacher-profiles.schema.json 中的 subjects 枚举保持一致
      subjectFilters: [
        { label: "全部科目", value: "" },
        { label: "语文", value: "语文" },
        { label: "数学", value: "数学" },
        { label: "英语", value: "英语" },
        { label: "物理", value: "物理" },
        { label: "化学", value: "化学" },
        { label: "生物", value: "生物" },
        { label: "历史", value: "历史" },
        { label: "地理", value: "地理" },
        { label: "政治", value: "政治" },
        { label: "其他", value: "其他" }
      ],
      // 年级筛选选项
      // 修改提示：可以在这里添加更多年级选项，或调整年级分类方式
      gradeFilters: [
        { label: "全部年级", value: "" },
        { label: "一年级", value: "一年级" },
        { label: "二年级", value: "二年级" },
        { label: "三年级", value: "三年级" },
        { label: "四年级", value: "四年级" },
        { label: "五年级", value: "五年级" },
        { label: "六年级", value: "六年级" },
        { label: "初一", value: "初一" },
        { label: "初二", value: "初二" },
        { label: "初三", value: "初三" },
        { label: "高一", value: "高一" },
        { label: "高二", value: "高二" },
        { label: "高三", value: "高三" }
      ],
      // 排序选项
      // 修改提示：可以在这里添加更多排序方式，如距离、好评率等
      sortOptions: [
        { label: "智能推荐", value: "rating" },
        { label: "人气优先", value: "newest" },
        { label: "价格从低到高", value: "price_asc" },
        { label: "价格从高到低", value: "price" }
      ],
      // 院校筛选选项
      schoolFilters: [
        { label: "全部院校", value: "" },
        { label: "四川大学", value: "四川大学" },
        { label: "电子科技大学", value: "电子科技大学" },
        { label: "西南交通大学", value: "西南交通大学" },
        { label: "四川农业大学", value: "四川农业大学" },
        { label: "西南财经大学", value: "西南财经大学" },
        { label: "其他985/211", value: "其他985/211" },
        { label: "专职老师", value: "专职老师" }
      ],
      // 教师资历筛选选项
      experienceFilters: [
        { label: "全部资历", value: "" },
        { label: "大一（高考刚结束）", value: "大一（高考刚结束）" },
        { label: "大二至大四（1年以内）", value: "大二至大四（1年以内）" },
        { label: "大二至大四（1-2年）", value: "大二至大四（1-2年）" },
        { label: "大二至大四（2年以上）", value: "大二至大四（2年以上）" },
        { label: "专职老师（1-3年）", value: "专职老师（1-3年）" },
        { label: "专职老师（3-5年）", value: "专职老师（3-5年）" },
        { label: "专职老师（5年以上）", value: "专职老师（5年以上）" }
      ],
      // 价格筛选选项
      priceFilters: [
        { label: "全部价格", value: "" },
        { label: "50-100元/小时", value: "50-100" },
        { label: "100-150元/小时", value: "100-150" },
        { label: "150-200元/小时", value: "150-200" },
        { label: "200-250元/小时", value: "200-250" },
        { label: "250元以上/小时", value: "250+" }
      ],
      // 老师位置筛选选项
      locationFilters: [
        { label: "全部位置", value: "" },
        { label: "武侯区", value: "武侯区" },
        { label: "青羊区", value: "青羊区" },
        { label: "金牛区", value: "金牛区" },
        { label: "锦江区", value: "锦江区" },
        { label: "成华区", value: "成华区" },
        { label: "高新区", value: "高新区" },
        { label: "双流区", value: "双流区" },
        { label: "郫都区", value: "郫都区" }
      ],
      // 附加标签筛选选项（多选）
      tagFilters: [
        { label: "有试课视频", value: "有试课视频" },
        { label: "家长好评50+", value: "家长好评50+" },
        { label: "可上门辅导", value: "可上门辅导" },
        { label: "擅长提分（中高考）", value: "擅长提分（中高考）" },
        { label: "耐心教基础薄弱生", value: "耐心教基础薄弱生" }
      ],
      // 当前展开的顶部筛选下拉：subject / grade / sort / ''
      activeDropdown: ""
    };
  },
  computed: {
    // 科目标签文案
    subjectLabel() {
      const item = this.subjectFilters.find((s) => s.value === this.selectedSubject);
      return item && item.value ? item.label : "";
    },
    // 年级标签文案
    gradeLabel() {
      const item = this.gradeFilters.find((g) => g.value === this.selectedGrade);
      return item && item.value ? item.label : "";
    },
    // 院校标签文案
    schoolLabel() {
      const item = this.schoolFilters.find((s) => s.value === this.selectedSchool);
      return item && item.value ? item.label : "";
    },
    // 教师资历标签文案
    experienceLabel() {
      const item = this.experienceFilters.find((e) => e.value === this.selectedExperience);
      return item && item.value ? item.label : "";
    },
    // 价格标签文案
    priceLabel() {
      const item = this.priceFilters.find((p) => p.value === this.selectedPrice);
      return item && item.value ? item.label : "";
    },
    // 排序标签文案
    sortLabel() {
      const item = this.sortOptions.find((o) => o.value === this.selectedSort);
      return item ? item.label : "智能推荐";
    },
    subjectDisplayLabel() {
      return this.subjectLabel || "";
    },
    subjectTabText() {
      return this.subjectDisplayLabel || "科目";
    },
    gradeDisplayLabel() {
      return this.gradeLabel || "";
    },
    gradeTabText() {
      return this.gradeDisplayLabel || "年级";
    },
    schoolDisplayLabel() {
      if (!this.schoolLabel)
        return "";
      if (this.schoolLabel.length <= 4)
        return this.schoolLabel;
      if (this.schoolLabel === "四川大学")
        return "川大";
      if (this.schoolLabel === "电子科技大学")
        return "电子科大";
      if (this.schoolLabel === "西南交通大学")
        return "西南交大";
      if (this.schoolLabel === "四川农业大学")
        return "川农";
      if (this.schoolLabel === "西南财经大学")
        return "西南财大";
      if (this.schoolLabel === "其他985/211")
        return "985/211";
      if (this.schoolLabel === "专职老师")
        return "专职";
      return "已选";
    },
    schoolTabText() {
      return this.schoolDisplayLabel || "院校";
    },
    experienceDisplayLabel() {
      if (!this.experienceLabel)
        return "";
      if (this.experienceLabel.includes("大一"))
        return "大一";
      if (this.experienceLabel.includes("1年以内"))
        return "1年内";
      if (this.experienceLabel.includes("1-2年"))
        return "1-2年";
      if (this.experienceLabel.includes("2年以上"))
        return "2年以上";
      if (this.experienceLabel.includes("1-3年"))
        return "1-3年";
      if (this.experienceLabel.includes("3-5年"))
        return "3-5年";
      if (this.experienceLabel.includes("5年以上"))
        return "5年以上";
      return "已选";
    },
    experienceTabText() {
      return this.experienceDisplayLabel || "资历";
    },
    priceDisplayLabel() {
      if (!this.priceLabel)
        return "";
      return this.priceLabel.replace("元/小时", "").replace("全部价格", "").replace("以上", "+");
    },
    priceTabText() {
      return this.priceDisplayLabel || "价格";
    },
    sortDisplayLabel() {
      const map = {
        rating: "",
        newest: "人气",
        price_asc: "低价",
        price: "高价"
      };
      return map[this.selectedSort] || "";
    },
    sortTabText() {
      return this.sortDisplayLabel || "排序";
    },
    // “全部”是否处于激活态（所有筛选都是默认值）
    isAllActive() {
      return !this.selectedSubject && !this.selectedGrade && !this.selectedSchool && !this.selectedExperience && !this.selectedPrice && !this.selectedLocation && this.selectedTags.length === 0 && this.selectedSort === "rating";
    }
  },
  /**
   * 页面加载时触发
   * 功能：初始化模拟数据开关，加载教师列表
   */
  onLoad() {
    this.useMock = utils_mockData.useMockData() === true;
    common_vendor.index.__f__("log", "at pages/teacher/list.vue:593", "[teacher-list] 年级筛选选项:", this.gradeFilters);
    common_vendor.index.__f__("log", "at pages/teacher/list.vue:594", "[teacher-list] 年级筛选选项数量:", this.gradeFilters.length);
    this.fetchUserLocation();
    this.$nextTick(() => {
      setTimeout(() => {
        this.loadTeachers(true);
      }, 50);
    });
  },
  onShareAppMessage() {
    return {
      title: "家教帮 · 找优质家教老师",
      path: "/pages/teacher/list"
    };
  },
  onShareTimeline() {
    return {
      title: "家教帮 · 找优质家教老师"
    };
  },
  methods: {
    // 顶部筛选栏：切换下拉
    toggleDropdown(type) {
      this.activeDropdown = this.activeDropdown === type ? "" : type;
    },
    // 关闭下拉
    closeDropdown() {
      this.activeDropdown = "";
    },
    // 选择科目
    handleSelectSubject(value) {
      this.changeSubject(value);
      this.closeDropdown();
    },
    // 选择年级
    handleSelectGrade(value) {
      this.changeGrade(value);
      this.closeDropdown();
    },
    // 选择院校
    handleSelectSchool(value) {
      this.changeSchool(value);
      this.closeDropdown();
    },
    // 选择教师资历
    handleSelectExperience(value) {
      this.changeExperience(value);
      this.closeDropdown();
    },
    // 选择价格区间
    handleSelectPrice(value) {
      this.changePrice(value);
      this.closeDropdown();
    },
    // 选择排序
    handleSelectSort(value) {
      this.changeSort(value);
      this.closeDropdown();
    },
    // 重置所有筛选（对应“全部”）
    resetAllFilters() {
      this.selectedSubject = "";
      this.selectedGrade = "";
      this.selectedSchool = "";
      this.selectedExperience = "";
      this.selectedPrice = "";
      this.selectedLocation = "";
      this.selectedTags = [];
      this.selectedSort = "rating";
      this.activeDropdown = "";
      this.loadTeachers(true);
    },
    /**
     * 下拉刷新数据
     * 功能：重新加载第一页数据
     */
    async refreshData() {
      common_vendor.index.__f__("log", "at pages/teacher/list.vue:671", "[teacher-list] 下拉刷新：重新加载教师列表");
      await this.loadTeachers(true);
    },
    /**
     * 加载教师列表
     * @param {Boolean} reset - 是否重置（重置页码和列表）
     * 功能：
     *   1. 根据搜索关键词、筛选条件、排序方式获取教师列表
     *   2. 支持分页加载
     *   3. 处理模拟数据和真实数据
     * 
     * 修改提示：
     *   - 修改分页大小：修改 pageSize 的值
     *   - 修改查询参数：修改传递给云函数的参数
     *   - 添加其他筛选条件：在查询参数中添加新字段
     */
    async loadTeachers(reset = false) {
      if (this.isLoading)
        return;
      if (!this.hasMore && !reset)
        return;
      this.isLoading = true;
      if (reset) {
        this.currentPage = 1;
        this.teacherList = [];
        this.hasMore = true;
      }
      try {
        if (this.useMock) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          const newList = utils_mockData.mockTeachers.slice(0, this.pageSize).map((item) => ({
            ...item,
            teacher_id: item.teacher_id || item._id
          }));
          this.teacherList = reset ? newList : [...this.teacherList, ...newList];
          this.hasMore = false;
          this.currentPage += 1;
          await this.syncFavorites();
          return;
        }
        let minPrice, maxPrice;
        if (this.selectedPrice) {
          if (this.selectedPrice === "50-100") {
            minPrice = 50;
            maxPrice = 100;
          } else if (this.selectedPrice === "100-150") {
            minPrice = 100;
            maxPrice = 150;
          } else if (this.selectedPrice === "150-200") {
            minPrice = 150;
            maxPrice = 200;
          } else if (this.selectedPrice === "200-250") {
            minPrice = 200;
            maxPrice = 250;
          } else if (this.selectedPrice === "250+") {
            minPrice = 250;
            maxPrice = void 0;
          }
        }
        const teacherListObj = common_vendor.tr.importObject("teacher-list", { customUI: true });
        const result = await teacherListObj.getList({
          page: this.currentPage,
          pageSize: this.pageSize,
          keyword: this.searchKeyword || void 0,
          subject: this.selectedSubject || void 0,
          grade: this.selectedGrade || void 0,
          school: this.selectedSchool || void 0,
          experience: this.selectedExperience || void 0,
          minPrice,
          maxPrice,
          location: this.selectedLocation || void 0,
          tags: this.selectedTags.length > 0 ? this.selectedTags : void 0,
          sortBy: this.selectedSort
        });
        if (result.code === 0) {
          const newList = (result.data.list || []).map((item) => ({
            ...item,
            teacher_id: item.teacher_id || item._id
          }));
          if (reset) {
            this.teacherList = newList;
          } else {
            this.teacherList = [...this.teacherList, ...newList];
          }
          const pagination = result.data.pagination || {};
          this.hasMore = pagination.hasMore !== void 0 ? pagination.hasMore : newList.length >= this.pageSize;
          this.currentPage = pagination.page ? pagination.page + 1 : this.currentPage + 1;
          await this.syncFavorites();
        } else {
          throw new Error(result.message || "加载教师失败");
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/teacher/list.vue:767", "加载教师失败:", error);
        common_vendor.index.showToast({ title: error.message || "加载失败", icon: "none" });
      } finally {
        this.isLoading = false;
        this.isRefreshing = false;
        this.loadingMore = false;
      }
    },
    /**
     * 处理滚动事件
     * @param {Object} e - 滚动事件对象
     * 功能：记录滚动位置，判断是否可以下拉刷新
     */
    handleScroll(e) {
      this.scrollTop = e.detail.scrollTop;
      this.canRefresh = e.detail.scrollTop <= 10;
    },
    /**
     * 滚动到顶部时触发
     * 功能：重置滚动状态，允许下拉刷新
     */
    handleScrollToUpper() {
      this.scrollTop = 0;
      this.canRefresh = true;
    },
    /**
     * 处理搜索
     * 功能：使用当前搜索关键词重新加载教师列表
     */
    handleSearch() {
      this.loadTeachers(true);
    },
    /**
     * 下拉刷新处理
     * 功能：检查是否可以刷新，如果可以则重新加载数据
     */
    onRefresh() {
      if (!this.canRefresh || this.scrollTop > 10) {
        this.isRefreshing = false;
        return;
      }
      this.isRefreshing = true;
      this.loadTeachers(true);
    },
    /**
     * 上拉加载更多
     * 功能：加载下一页数据
     */
    loadMore() {
      if (this.hasMore && !this.loadingMore && !this.isRefreshing) {
        this.loadingMore = true;
        this.loadTeachers();
      }
    },
    /**
     * 切换科目筛选
     * @param {String} value - 科目值（空字符串表示全部）
     * 功能：更新选中的科目，重新加载列表
     */
    changeSubject(value) {
      if (this.selectedSubject === value)
        return;
      this.selectedSubject = value;
      this.loadTeachers(true);
    },
    /**
     * 切换年级筛选
     * @param {String} value - 年级值（空字符串表示全部）
     * 功能：更新选中的年级，重新加载列表
     */
    changeGrade(value) {
      if (this.selectedGrade === value)
        return;
      this.selectedGrade = value;
      this.loadTeachers(true);
    },
    /**
     * 切换排序方式
     * @param {String} value - 排序值：'rating'、'newest'、'price_asc'、'price'
     * 功能：更新排序方式，重新加载列表
     */
    changeSort(value) {
      if (this.selectedSort === value)
        return;
      this.selectedSort = value;
      this.loadTeachers(true);
    },
    /**
     * 切换院校筛选
     * @param {String} value - 院校值（空字符串表示全部）
     * 功能：更新选中的院校，重新加载列表
     */
    changeSchool(value) {
      if (this.selectedSchool === value)
        return;
      this.selectedSchool = value;
      this.loadTeachers(true);
    },
    /**
     * 切换资历筛选
     * @param {String} value - 资历值（空字符串表示全部）
     * 功能：更新选中的资历，重新加载列表
     */
    changeExperience(value) {
      if (this.selectedExperience === value)
        return;
      this.selectedExperience = value;
      this.loadTeachers(true);
    },
    /**
     * 切换价格筛选
     * @param {String} value - 价格区间值（空字符串表示全部）
     * 功能：更新选中的价格区间，重新加载列表
     */
    changePrice(value) {
      if (this.selectedPrice === value)
        return;
      this.selectedPrice = value;
      this.loadTeachers(true);
    },
    /**
     * 切换位置筛选
     * @param {String} value - 位置值（空字符串表示全部）
     * 功能：更新选中的位置，重新加载列表
     */
    changeLocation(value) {
      if (this.selectedLocation === value)
        return;
      this.selectedLocation = value;
      this.loadTeachers(true);
    },
    /**
     * 切换标签筛选（多选）
     * @param {String} value - 标签值
     * 功能：切换标签的选中状态，重新加载列表
     */
    toggleTag(value) {
      const index = this.selectedTags.indexOf(value);
      if (index > -1) {
        this.selectedTags.splice(index, 1);
      } else {
        this.selectedTags.push(value);
      }
      this.loadTeachers(true);
    },
    /**
     * 同步收藏状态
     * 功能：
     *   1. 从云函数获取当前用户的收藏列表
     *   2. 更新 favoriteIds
     *   3. 为教师列表中的每个教师设置 is_favorited 状态
     * 修改提示：可以在这里添加收藏状态的缓存逻辑
     */
    async syncFavorites() {
      try {
        if (this.useMock) {
          this.favoriteIds = utils_mockData.mockTeachers.slice(0, 1).map((item) => item.teacher_id || item._id);
          this.applyFavoriteStatus();
          return;
        }
        const stored = common_vendor.index.getStorageSync("userInfo") || {};
        if (!stored.uid) {
          this.favoriteIds = [];
          this.applyFavoriteStatus();
          return;
        }
        const favoriteObj = common_vendor.tr.importObject("teacher-favorite", { customUI: true });
        const res = await favoriteObj.getParentFavorites();
        if (res.code === 0 && res.data) {
          this.favoriteIds = (res.data.list || []).map((item) => item.teacher_id);
        } else {
          this.favoriteIds = [];
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/teacher/list.vue:934", "获取收藏状态失败:", error);
      } finally {
        this.applyFavoriteStatus();
      }
    },
    /**
     * 应用收藏状态到教师列表
     * 功能：根据 favoriteIds 为每个教师设置 is_favorited 属性
     */
    applyFavoriteStatus() {
      const idSet = new Set(this.favoriteIds || []);
      this.teacherList.forEach((item) => {
        const id = item.teacher_id || item._id;
        item.is_favorited = idSet.has(id);
      });
    },
    /**
     * 切换收藏状态
     * @param {Object} teacher - 教师对象
     * 功能：
     *   1. 如果已收藏，则取消收藏
     *   2. 如果未收藏，则添加收藏
     *   3. 更新本地状态和云数据库
     * 
     * 修改提示：
     *   - 可以添加收藏前的验证逻辑（如登录检查）
     *   - 可以添加收藏成功的回调处理
     */
    async toggleFavorite(teacher) {
      const teacherId = teacher.teacher_id || teacher._id;
      if (!teacherId) {
        common_vendor.index.showToast({ title: "教师信息不完整", icon: "none" });
        return;
      }
      try {
        if (this.useMock) {
          teacher.is_favorited = !teacher.is_favorited;
          if (teacher.is_favorited) {
            if (!this.favoriteIds.includes(teacherId)) {
              this.favoriteIds.push(teacherId);
            }
            common_vendor.index.showToast({ title: "收藏成功", icon: "success" });
          } else {
            this.favoriteIds = this.favoriteIds.filter((id) => id !== teacherId);
            common_vendor.index.showToast({ title: "已取消收藏", icon: "success" });
          }
          return;
        }
        const stored = common_vendor.index.getStorageSync("userInfo") || {};
        if (!stored.uid) {
          common_vendor.index.showToast({ title: "请先登录", icon: "none" });
          return;
        }
        const favoriteObj = common_vendor.tr.importObject("teacher-favorite", { customUI: true });
        if (teacher.is_favorited) {
          const res = await favoriteObj.removeFavorite({ teacher_id: teacherId });
          if (res.code === 0) {
            teacher.is_favorited = false;
            this.favoriteIds = this.favoriteIds.filter((id) => id !== teacherId);
            common_vendor.index.showToast({ title: "已取消收藏", icon: "success" });
          } else {
            common_vendor.index.showToast({ title: res.message || "取消失败", icon: "none" });
          }
        } else {
          const res = await favoriteObj.addFavorite({ teacher_id: teacherId });
          if (res.code === 0) {
            teacher.is_favorited = true;
            if (!this.favoriteIds.includes(teacherId)) {
              this.favoriteIds.push(teacherId);
            }
            common_vendor.index.showToast({ title: "收藏成功", icon: "success" });
          } else {
            common_vendor.index.showToast({ title: res.message || "收藏失败", icon: "none" });
          }
        }
      } catch (error) {
        common_vendor.index.__f__("error", "at pages/teacher/list.vue:1012", "操作收藏失败:", error);
        common_vendor.index.showToast({ title: "操作失败，请稍后再试", icon: "none" });
      }
    },
    goToDetail(teacher) {
      const profileId = teacher._id || teacher.id;
      const teacherUid = teacher.teacher_id || "";
      if (!profileId) {
        common_vendor.index.showToast({ title: "教师信息不完整", icon: "none" });
        return;
      }
      const params = [`id=${profileId}`];
      if (teacherUid)
        params.push(`teacherUid=${teacherUid}`);
      common_vendor.index.navigateTo({ url: `/pages/teacher/detail?${params.join("&")}` });
    },
    formatPercent(rate) {
      if (!rate && rate !== 0)
        return "0%";
      return `${(Number(rate) * 100).toFixed(0)}%`;
    },
    formatRating(rating) {
      if (!rating && rating !== 0)
        return "5.0";
      return Number(rating).toFixed(1);
    },
    /**
     * 获取院校和教龄信息
     * @param {Object} teacher - 教师对象
     * @returns {String} 格式化的院校和教龄信息
     */
    getSchoolAndExperience(teacher) {
      var _a;
      const school = teacher.school || "";
      const years = teacher.experience_years || ((_a = teacher.teaching_experience) == null ? void 0 : _a.years) || 0;
      const parts = [];
      if (school) {
        parts.push(school);
      }
      if (years > 0) {
        parts.push(`教龄${years}年`);
      }
      return parts.length > 0 ? parts.join("・") : "专业教师";
    },
    /**
     * 获取好评率
     * @param {Object} teacher - 教师对象
     * @returns {Number} 好评率（百分比）
     */
    getPositiveRate(teacher) {
      if (teacher.positive_rate !== void 0) {
        return Math.round(teacher.positive_rate);
      }
      const rating = teacher.rating || 5;
      if (rating >= 4.5)
        return 98;
      if (rating >= 4)
        return 95;
      if (rating >= 3.5)
        return 90;
      if (rating >= 3)
        return 85;
      return 80;
    },
    /** 获取用户位置（用于距离计算） */
    async fetchUserLocation() {
      try {
        const res = await common_vendor.index.getLocation({ type: "gcj02" });
        if (res.latitude != null && res.longitude != null) {
          this.userLocation = { lat: res.latitude, lon: res.longitude };
        }
      } catch (e) {
      }
    },
    /**
     * 教师教学地址（取第一个教学区域）
     * @param {Object} teacher - 教师对象（含 teaching_areas）
     * @returns {String}
     */
    getTeacherAddress(teacher) {
      const areas = teacher.teaching_areas || [];
      if (!areas.length)
        return "";
      const area = areas[0];
      if (area.name && String(area.name).trim())
        return String(area.name).trim();
      const parts = [area.province, area.city, area.district, area.address].filter(Boolean);
      return parts.join(" ") || "";
    },
    /**
     * 与教师的距离（km），无位置或教师无坐标时返回 null
     * @param {Object} teacher - 教师对象（含 teaching_areas，项可有 latitude/longitude）
     * @returns {String|null} 如 "3.2"，或 null
     */
    getTeacherDistance(teacher) {
      if (!this.userLocation || this.userLocation.lat == null || this.userLocation.lon == null)
        return null;
      const areas = teacher.teaching_areas || [];
      const withCoord = areas.find((a) => a.latitude != null && a.longitude != null);
      if (!withCoord)
        return null;
      const km = this.haversineKm(
        this.userLocation.lat,
        this.userLocation.lon,
        parseFloat(withCoord.latitude),
        parseFloat(withCoord.longitude)
      );
      return km == null ? null : km.toFixed(1);
    },
    /** 两点经纬度距离（km），Haversine */
    haversineKm(lat1, lon1, lat2, lon2) {
      if (lat1 == null || lon1 == null || lat2 == null || lon2 == null)
        return null;
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    /**
     * 格式化年级显示
     * @param {Array} grades - 年级数组
     * @returns {String} 格式化的年级字符串
     */
    formatGrades(grades) {
      if (!Array.isArray(grades) || grades.length === 0)
        return "";
      const primary = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"];
      const junior = ["初一", "初二", "初三"];
      const senior = ["高一", "高二", "高三"];
      const primaryGrades = grades.filter((g) => primary.includes(g));
      const juniorGrades = grades.filter((g) => junior.includes(g));
      const seniorGrades = grades.filter((g) => senior.includes(g));
      const parts = [];
      if (primaryGrades.length > 0) {
        if (primaryGrades.length === 6) {
          parts.push("小学");
        } else {
          parts.push(`小学(${primaryGrades.length}个年级)`);
        }
      }
      if (juniorGrades.length > 0) {
        if (juniorGrades.length === 3) {
          parts.push("初中");
        } else {
          parts.push(`初中(${juniorGrades.length}个年级)`);
        }
      }
      if (seniorGrades.length > 0) {
        if (seniorGrades.length === 3) {
          parts.push("高中");
        } else {
          parts.push(`高中(${seniorGrades.length}个年级)`);
        }
      }
      return parts.length > 0 ? parts.join("、") : grades.slice(0, 3).join("、");
    },
    /**
     * 获取标签样式
     * @param {Number} index - 标签索引
     * @returns {String} 样式字符串
     */
    getTagStyle(index) {
      const styles = [
        "background: #E6F3FF; color: #4A90E2;",
        // 浅蓝色
        "background: #D6EBFF; color: #357ABD;",
        // 中蓝色
        "background: #C6E3FF; color: #2A5F8F;",
        // 深蓝色
        "background: #E8F4FF; color: #5BA3F0;"
        // 淡蓝色
      ];
      return styles[index % styles.length];
    },
    /**
     * 获取教学方式
     * @param {Object} teacher - 教师对象
     * @returns {String} 教学方式
     */
    getTeachingMethod(teacher) {
      const methods = teacher.teaching_methods || [];
      if (methods.includes("online") && methods.includes("offline")) {
        return "线上/线下";
      } else if (methods.includes("online")) {
        return "线上辅导";
      } else if (methods.includes("offline")) {
        return "线下辅导";
      }
      return "";
    },
    /**
     * 获取专业特长
     * @param {Object} teacher - 教师对象
     * @returns {String} 专业特长
     */
    getSpecialty(teacher) {
      const tags = teacher.tags || [];
      if (tags.length === 0)
        return "";
      const specialtyMap = {
        "擅长提分（中高考）": "提分专家",
        "耐心教基础薄弱生": "基础教学",
        "有试课视频": "视频教学",
        "可上门辅导": "上门服务"
      };
      const specialties = tags.filter((tag) => specialtyMap[tag]).map((tag) => specialtyMap[tag]).slice(0, 2);
      return specialties.length > 0 ? specialties.join(" | ") : "";
    },
    /**
     * 切换筛选分类的展开/收起状态
     * @param {String} section - 分类名称：'subject'（科目）、'grade'（年级）、'sort'（排序）
     * 功能：控制指定筛选分类的展开和收起，收起时隐藏该分类下的所有选项
     */
    toggleFilterSection(section) {
      this.filterSectionsExpanded[section] = !this.filterSectionsExpanded[section];
    }
  }
};
if (!Array) {
  const _component_LocationBar = common_vendor.resolveComponent("LocationBar");
  const _component_ParentTabBar = common_vendor.resolveComponent("ParentTabBar");
  (_component_LocationBar + _component_ParentTabBar)();
}
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.handleSearch && $options.handleSearch(...args)),
    b: $data.searchKeyword,
    c: common_vendor.o(common_vendor.m(($event) => $data.searchKeyword = $event.detail.value, {
      trim: true
    })),
    d: common_vendor.o((...args) => $options.handleSearch && $options.handleSearch(...args)),
    e: $options.isAllActive ? 1 : "",
    f: common_vendor.o((...args) => $options.resetAllFilters && $options.resetAllFilters(...args)),
    g: common_vendor.t($options.subjectTabText),
    h: $data.activeDropdown === "subject" || !!$data.selectedSubject ? 1 : "",
    i: common_vendor.o(($event) => $options.toggleDropdown("subject")),
    j: common_vendor.t($options.gradeTabText),
    k: $data.activeDropdown === "grade" || !!$data.selectedGrade ? 1 : "",
    l: common_vendor.o(($event) => $options.toggleDropdown("grade")),
    m: common_vendor.t($options.schoolTabText),
    n: $data.activeDropdown === "school" || !!$data.selectedSchool ? 1 : "",
    o: common_vendor.o(($event) => $options.toggleDropdown("school")),
    p: common_vendor.t($options.experienceTabText),
    q: $data.activeDropdown === "experience" || !!$data.selectedExperience ? 1 : "",
    r: common_vendor.o(($event) => $options.toggleDropdown("experience")),
    s: common_vendor.t($options.priceTabText),
    t: $data.activeDropdown === "price" || !!$data.selectedPrice ? 1 : "",
    v: common_vendor.o(($event) => $options.toggleDropdown("price")),
    w: common_vendor.t($options.sortTabText),
    x: $data.activeDropdown === "sort" || $data.selectedSort !== "rating" ? 1 : "",
    y: common_vendor.o(($event) => $options.toggleDropdown("sort")),
    z: $data.activeDropdown
  }, $data.activeDropdown ? common_vendor.e({
    A: $data.activeDropdown === "subject"
  }, $data.activeDropdown === "subject" ? {
    B: common_vendor.f($data.subjectFilters, (item, k0, i0) => {
      return {
        a: common_vendor.t(item.label),
        b: item.value,
        c: $data.selectedSubject === item.value ? 1 : "",
        d: common_vendor.o(($event) => $options.handleSelectSubject(item.value), item.value)
      };
    })
  } : $data.activeDropdown === "grade" ? {
    D: common_vendor.f($data.gradeFilters, (item, k0, i0) => {
      return {
        a: common_vendor.t(item.label),
        b: item.value,
        c: $data.selectedGrade === item.value ? 1 : "",
        d: common_vendor.o(($event) => $options.handleSelectGrade(item.value), item.value)
      };
    })
  } : $data.activeDropdown === "school" ? {
    F: common_vendor.f($data.schoolFilters, (item, k0, i0) => {
      return {
        a: common_vendor.t(item.label),
        b: item.value,
        c: $data.selectedSchool === item.value ? 1 : "",
        d: common_vendor.o(($event) => $options.handleSelectSchool(item.value), item.value)
      };
    })
  } : $data.activeDropdown === "experience" ? {
    H: common_vendor.f($data.experienceFilters, (item, k0, i0) => {
      return {
        a: common_vendor.t(item.label),
        b: item.value,
        c: $data.selectedExperience === item.value ? 1 : "",
        d: common_vendor.o(($event) => $options.handleSelectExperience(item.value), item.value)
      };
    })
  } : $data.activeDropdown === "price" ? {
    J: common_vendor.f($data.priceFilters, (item, k0, i0) => {
      return {
        a: common_vendor.t(item.label),
        b: item.value,
        c: $data.selectedPrice === item.value ? 1 : "",
        d: common_vendor.o(($event) => $options.handleSelectPrice(item.value), item.value)
      };
    })
  } : $data.activeDropdown === "sort" ? {
    L: common_vendor.f($data.sortOptions, (item, k0, i0) => {
      return {
        a: common_vendor.t(item.label),
        b: item.value,
        c: $data.selectedSort === item.value ? 1 : "",
        d: common_vendor.o(($event) => $options.handleSelectSort(item.value), item.value)
      };
    })
  } : {}, {
    C: $data.activeDropdown === "grade",
    E: $data.activeDropdown === "school",
    G: $data.activeDropdown === "experience",
    I: $data.activeDropdown === "price",
    K: $data.activeDropdown === "sort",
    M: common_vendor.o(() => {
    }),
    N: common_vendor.o((...args) => $options.closeDropdown && $options.closeDropdown(...args))
  }) : {}, {
    O: $data.isLoading && !$data.teacherList.length
  }, $data.isLoading && !$data.teacherList.length ? {
    P: common_vendor.f(4, (n, k0, i0) => {
      return {
        a: n
      };
    })
  } : common_vendor.e({
    Q: common_vendor.f($data.teacherList, (teacher, k0, i0) => {
      return common_vendor.e({
        a: teacher.is_favorited ? $data.favoriteFilledUrl : $data.favoriteEmptyUrl,
        b: common_vendor.o(($event) => $options.toggleFavorite(teacher), teacher._id),
        c: teacher.avatar || $data.defaultAvatarUrl,
        d: common_vendor.t(teacher.display_name || teacher.name || "教师"),
        e: teacher.is_verified
      }, teacher.is_verified ? {} : {}, {
        f: common_vendor.t($options.getSchoolAndExperience(teacher)),
        g: common_vendor.t($options.getPositiveRate(teacher)),
        h: teacher.trial_count > 0
      }, teacher.trial_count > 0 ? {
        i: common_vendor.t(teacher.trial_count)
      } : {}, {
        j: (teacher.trial_success_count || 0) > 0
      }, (teacher.trial_success_count || 0) > 0 ? {
        k: common_vendor.t(teacher.trial_success_count)
      } : {}, {
        l: teacher.trial_success_rate > 0
      }, teacher.trial_success_rate > 0 ? {
        m: common_vendor.t($options.formatPercent(teacher.trial_success_rate))
      } : {}, {
        n: $options.getTeacherAddress(teacher)
      }, $options.getTeacherAddress(teacher) ? common_vendor.e({
        o: common_vendor.t($options.getTeacherAddress(teacher)),
        p: $options.getTeacherDistance(teacher) != null
      }, $options.getTeacherDistance(teacher) != null ? {
        q: common_vendor.t($options.getTeacherDistance(teacher))
      } : {}) : {}, {
        r: (teacher.subjects || []).length
      }, (teacher.subjects || []).length ? common_vendor.e({
        s: common_vendor.t((teacher.subjects || []).slice(0, 2).join("、")),
        t: (teacher.subjects || []).length > 2
      }, (teacher.subjects || []).length > 2 ? {
        v: common_vendor.t(teacher.subjects.length)
      } : {}) : {}, {
        w: (teacher.grades || []).length
      }, (teacher.grades || []).length ? {
        x: common_vendor.t($options.formatGrades(teacher.grades))
      } : {}, {
        y: (teacher.subjects || []).length
      }, (teacher.subjects || []).length ? {
        z: common_vendor.f((teacher.subjects || []).slice(0, 4), (subject, index, i1) => {
          return {
            a: common_vendor.t(subject),
            b: subject,
            c: common_vendor.s($options.getTagStyle(index))
          };
        })
      } : {}, {
        A: common_vendor.t(teacher.hourly_rate || 100),
        B: $options.getTeachingMethod(teacher)
      }, $options.getTeachingMethod(teacher) ? {
        C: common_vendor.t($options.getTeachingMethod(teacher))
      } : {}, {
        D: $options.getSpecialty(teacher)
      }, $options.getSpecialty(teacher) ? {
        E: common_vendor.t($options.getSpecialty(teacher))
      } : {}, {
        F: teacher._id,
        G: common_vendor.o(($event) => $options.goToDetail(teacher), teacher._id)
      });
    }),
    R: !$data.teacherList.length && !$data.isLoading
  }, !$data.teacherList.length && !$data.isLoading ? {} : {}, {
    S: $data.isLoading && $data.teacherList.length
  }, $data.isLoading && $data.teacherList.length ? {} : !$data.hasMore && $data.teacherList.length ? {} : {}, {
    T: !$data.hasMore && $data.teacherList.length
  }), {
    U: common_vendor.o((...args) => $options.loadMore && $options.loadMore(...args)),
    V: common_vendor.p({
      current: "teacher"
    })
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-808011a9"]]);
_sfc_main.__runtimeHooks = 6;
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/teacher/list.js.map
