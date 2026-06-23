const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");
const config = require("../config");

module.exports = {
    name: "sendembed",
    async execute(message) {
        if (!message.member.permissions.has("Administrator")) {
            return message.reply({ content: "**ليس لديك صلاحية لاستخدام هذا الأمر.**" });
        }

        const container = new ContainerBuilder()
            .setAccentColor(config.EMBED_COLOR)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**${config.STUDIO_EMBED.title}**\n\n${config.STUDIO_EMBED.description}`
                )
            )
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("publish_script")
                        .setLabel("انشر عملك")
                        .setStyle(ButtonStyle.Danger)
                )
            );

        await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        await message.delete().catch(() => {});
    },
};
