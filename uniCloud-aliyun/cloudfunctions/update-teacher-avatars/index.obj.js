// 云对象：批量更新教师头像
module.exports = {
  /**
   * 批量更新教师头像
   * @param {Object} params
   * @param {Array} params.avatarList - 头像列表，格式：[{teacherId: 'xxx', fileID: 'cloud://...'}, ...]
   * @returns {Object}
   */
  async batchUpdateAvatars(params) {
    const { avatarList = [] } = params;
    
    if (!Array.isArray(avatarList) || avatarList.length === 0) {
      return {
        code: -1,
        message: '请提供头像列表',
        data: null
      };
    }
    
    try {
      const db = uniCloud.database();
      const results = {
        success: [],
        failed: []
      };
      
      for (const item of avatarList) {
        try {
          const { teacherId, fileID } = item;
          
          if (!teacherId || !fileID) {
            results.failed.push({
              teacherId: teacherId || 'unknown',
              reason: 'teacherId或fileID为空'
            });
            continue;
          }
          
          const now = Date.now();
          
          // 更新 teacher-profiles 表
          const profileUpdate = await db.collection('teacher-profiles')
            .where({
              teacher_id: teacherId
            })
            .update({
              avatar: fileID,
              update_time: now
            });
          
          // 更新 uni-id-users 表
          await db.collection('uni-id-users')
            .doc(teacherId)
            .update({
              avatar: fileID
            });
          
          results.success.push({
            teacherId,
            fileID,
            updated: profileUpdate.updated || 0
          });
          
          console.log(`成功更新头像: ${teacherId}`);
        } catch (error) {
          console.error(`更新头像失败 ${item.teacherId}:`, error);
          results.failed.push({
            teacherId: item.teacherId || 'unknown',
            reason: error.message || '更新失败'
          });
        }
      }
      
      return {
        code: 0,
        message: `处理完成：成功 ${results.success.length} 个，失败 ${results.failed.length} 个`,
        data: results
      };
      
    } catch (error) {
      console.error('批量更新头像失败:', error);
      return {
        code: -1,
        message: '批量更新失败: ' + error.message,
        data: null
      };
    }
  }
};
