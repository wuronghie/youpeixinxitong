'use strict';

const db = uniCloud.database();
const dbCmd = db.command;

exports.main = async (event, context) => {
	const { action, data } = event;
	
	try {
		switch (action) {
			case 'sendMessage':
				return await sendMessage(data);
			case 'getMessageList':
				return await getMessageList(data);
			case 'markAsRead':
				return await markAsRead(data);
			case 'getUnreadCount':
				return await getUnreadCount(data);
			default:
				return {
					code: 400,
					message: '未知操作'
				};
		}
	} catch (error) {
		console.error('消息服务错误:', error);
		return {
			code: 500,
			message: '服务器内部错误',
			error: error.message
		};
	}
};

// 发送消息
async function sendMessage(data) {
	const { fromId, toId, content, type = 0 } = data;
	
	if (!fromId || !toId || !content) {
		return {
			code: 400,
			message: '发送者ID、接收者ID和消息内容不能为空'
		};
	}
	
	// 敏感词过滤
	const filteredContent = await filterSensitiveWords(content);
	
	const messageData = {
		from_id: fromId,
		to_id: toId,
		content: filteredContent,
		type: type,
		read: false,
		create_time: new Date()
	};
	
	const result = await db.collection('message').add(messageData);
	
	return {
		code: 200,
		message: '发送成功',
		data: {
			messageId: result.id
		}
	};
}

// 获取消息列表
async function getMessageList(data) {
	const { userId, chatUserId, page = 1, pageSize = 20 } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	let query = db.collection('message');
	
	if (chatUserId) {
		// 获取与特定用户的聊天记录
		query = query.where(dbCmd.or([
			dbCmd.and([
				{ from_id: userId },
				{ to_id: chatUserId }
			]),
			dbCmd.and([
				{ from_id: chatUserId },
				{ to_id: userId }
			])
		]));
	} else {
		// 获取用户的所有消息
		query = query.where(dbCmd.or([
			{ from_id: userId },
			{ to_id: userId }
		]));
	}
	
	// 排序
	query = query.orderBy('create_time', 'desc');
	
	// 分页
	const skip = (page - 1) * pageSize;
	query = query.skip(skip).limit(pageSize);
	
	const result = await query.get();
	
	// 获取总数
	const countQuery = db.collection('message');
	if (chatUserId) {
		countQuery.where(dbCmd.or([
			dbCmd.and([
				{ from_id: userId },
				{ to_id: chatUserId }
			]),
			dbCmd.and([
				{ from_id: chatUserId },
				{ to_id: userId }
			])
		]));
	} else {
		countQuery.where(dbCmd.or([
			{ from_id: userId },
			{ to_id: userId }
		]));
	}
	const countResult = await countQuery.count();
	
	return {
		code: 200,
		message: '获取成功',
		data: {
			list: result.data.reverse(), // 按时间正序返回
			total: countResult.total,
			page: page,
			pageSize: pageSize
		}
	};
}

// 标记消息为已读
async function markAsRead(data) {
	const { messageIds, userId } = data;
	
	if (!messageIds || !Array.isArray(messageIds)) {
		return {
			code: 400,
			message: '消息ID列表不能为空'
		};
	}
	
	// 验证消息是否属于当前用户
	const messagesResult = await db.collection('message')
		.where({
			_id: dbCmd.in(messageIds),
			to_id: userId
		})
		.get();
	
	if (messagesResult.data.length !== messageIds.length) {
		return {
			code: 403,
			message: '部分消息无权限操作'
		};
	}
	
	const result = await db.collection('message')
		.where({
			_id: dbCmd.in(messageIds)
		})
		.update({
			read: true
		});
	
	return {
		code: 200,
		message: '标记成功',
		data: {
			updated: result.updated
		}
	};
}

// 获取未读消息数量
async function getUnreadCount(data) {
	const { userId } = data;
	
	if (!userId) {
		return {
			code: 400,
			message: '用户ID不能为空'
		};
	}
	
	const result = await db.collection('message')
		.where({
			to_id: userId,
			read: false
		})
		.count();
	
	return {
		code: 200,
		message: '获取成功',
		data: {
			unreadCount: result.total
		}
	};
}

// 敏感词过滤
async function filterSensitiveWords(content) {
	// 这里可以接入敏感词过滤服务
	// 暂时返回原内容，实际项目中需要实现敏感词过滤逻辑
	const sensitiveWords = [
		'微信', 'QQ', '电话', '手机号', '联系方式',
		'加微信', '加QQ', '私下联系', '绕过平台'
	];
	
	let filteredContent = content;
	
	for (const word of sensitiveWords) {
		const regex = new RegExp(word, 'gi');
		filteredContent = filteredContent.replace(regex, '***');
	}
	
	return filteredContent;
}
