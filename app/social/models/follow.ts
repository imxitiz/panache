import { column, belongsTo } from '@adonisjs/lucid/orm'
import BaseModel from '#common/models/base_model'
import Profile from './profile.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Follow extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare followerId: string

  @column()
  declare followingId: string

  @belongsTo(() => Profile, { foreignKey: 'followerId' })
  declare follower: BelongsTo<typeof Profile>

  @belongsTo(() => Profile, { foreignKey: 'followingId' })
  declare following: BelongsTo<typeof Profile>
}
