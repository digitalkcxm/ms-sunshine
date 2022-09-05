import moment from 'moment'

export async function up(knex) {
  await knex.schema.createTable('switchboards_integrations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('settings_id').notNullable()
    table.string('name').notNullable()
    table.string('switchboardID').notNullable()
    table.string('integrationID').notNullable()
    table.string('integrationType').notNullable()
    table.string('deliverStandbyEvents').notNullable()
    table.string('nextSwitchboardIntegrationID').notNullable()
    table.string('switchboardIntegrationsID').notNullable()
    table.string('messageHistoryCount').notNullable()
    table.string('source')
    table.boolean('activated').defaultTo(true).notNullable()
    table.timestamps(true, true)
    table.foreign('settings_id').references('settings.id')
  })
  return console.log(`✅  ${moment().format('DD-MM-YYYY HH:mm:ss')} 20220412025531_create_table_settings successful.`)
}

export async function down(knex) {}
