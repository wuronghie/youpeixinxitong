// 表单校验规则由 schema2code 生成，不建议直接修改校验规则，而建议通过 schema2code 生成, 详情: https://uniapp.dcloud.net.cn/uniCloud/schema


const validator = {
  "teacher_id": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ]
  },
  "display_name": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "title": "显示名称",
    "label": "显示名称"
  },
  "avatar": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "title": "头像",
    "label": "头像"
  },
  "subjects": {
    "rules": [
      {
        "format": "array"
      }
    ],
    "title": "教学科目",
    "label": "教学科目"
  },
  "grades": {
    "rules": [
      {
        "format": "array"
      }
    ],
    "title": "适合年级",
    "label": "适合年级"
  },
  "hourly_rate": {
    "rules": [
      {
        "format": "number"
      },
      {
        "minimum": 0
      }
    ],
    "title": "课时费",
    "label": "课时费"
  },
  "rating": {
    "rules": [
      {
        "format": "number"
      },
      {
        "minimum": 0,
        "maximum": 5
      }
    ],
    "title": "评分",
    "defaultValue": 5,
    "label": "评分"
  },
  "review_count": {
    "rules": [
      {
        "format": "int"
      },
      {
        "minimum": 0
      }
    ],
    "title": "评价数量",
    "defaultValue": 0,
    "label": "评价数量"
  },
  "introduction": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "title": "个人介绍",
    "label": "个人介绍"
  },
  "teaching_areas": {
    "rules": [
      {
        "format": "array"
      }
    ],
    "title": "教学区域",
    "label": "教学区域"
  },
  "is_verified": {
    "rules": [
      {
        "format": "bool"
      }
    ],
    "title": "是否已认证",
    "defaultValue": false,
    "label": "是否已认证"
  },
  "available": {
    "rules": [
      {
        "format": "bool"
      }
    ],
    "title": "是否接受预约",
    "defaultValue": true,
    "label": "是否接受预约"
  },
  "total_courses": {
    "rules": [
      {
        "format": "int"
      }
    ],
    "title": "总课程数",
    "defaultValue": 0,
    "label": "总课程数"
  },
  "total_students": {
    "rules": [
      {
        "format": "int"
      }
    ],
    "title": "总学生数",
    "defaultValue": 0,
    "label": "总学生数"
  }
}

const enumConverter = {}

function filterToWhere(filter, command) {
  let where = {}
  for (let field in filter) {
    let { type, value } = filter[field]
    switch (type) {
      case "search":
        if (typeof value === 'string' && value.length) {
          where[field] = new RegExp(value)
        }
        break;
      case "select":
        if (value.length) {
          let selectValue = []
          for (let s of value) {
            selectValue.push(command.eq(s))
          }
          where[field] = command.or(selectValue)
        }
        break;
      case "range":
        if (value.length) {
          let gt = value[0]
          let lt = value[1]
          where[field] = command.and([command.gte(gt), command.lte(lt)])
        }
        break;
      case "date":
        if (value.length) {
          let [s, e] = value
          let startDate = new Date(s)
          let endDate = new Date(e)
          where[field] = command.and([command.gte(startDate), command.lte(endDate)])
        }
        break;
      case "timestamp":
        if (value.length) {
          let [startDate, endDate] = value
          where[field] = command.and([command.gte(startDate), command.lte(endDate)])
        }
        break;
    }
  }
  return where
}

export { validator, enumConverter, filterToWhere }

