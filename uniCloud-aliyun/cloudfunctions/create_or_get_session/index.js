'use strict';
const db = uniCloud.database();

exports.main = async (event, context) => {
	console.log('create_or_get_session event:', event);
	
	const { parent_id, teacher_id, parent_name, teacher_name, parent_avatar, teacher_avatar } = event;
	
	if (!parent_id || !teacher_id) {
		return {
			code: 400,
			message: '缺少必要参数'
		};
	}
	
	try {
		// 先查找是否已存在会话
		const existingSession = await db.collection('chat_sessions')
			.where({
				parent_id: parent_id,
				teacher_id: teacher_id
			})
			.get();
		
		if (existingSession.data.length > 0) {
			// 会话已存在，返回会话信息
			return {
				code: 0,
				message: '会话已存在',
				data: {
					session_id: existingSession.data[0]._id,
					created: false
				}
			};
		}
		
		// 创建新会话
		const now = new Date();
		const sessionData = {
			parent_id: parent_id,
			teacher_id: teacher_id,
			parent_name: parent_name || '家长',
			teacher_name: teacher_name || '老师',
			parent_avatar: parent_avatar || '/static/default-avatar.png',
			teacher_avatar: teacher_avatar || '/static/default-avatar.png',
			last_message: '',
			last_message_time: now,
			last_message_sender: '',
			parent_unread_count: 0,
			teacher_unread_count: 0,
			create_time: now,
			update_time: now
		};
		
		const result = await db.collection('chat_sessions').add(sessionData);
		
		return {
			code: 0,
			message: '会话创建成功',
			data: {
				session_id: result.id,
				created: true
			}
		};
		
	} catch (error) {
		console.error('create_or_get_session error:', error);
		return {
			code: 500,
			message: '服务器错误',
			error: error.message
		};
	}
};
