const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");

module.exports = {
    name: "sendembed",
    async execute(message) {
        if (!message.member.permissions.has("Administrator")) {
            return message.reply({ content: "**ليس لديك صلاحية لاستخدام هذا الأمر.**" });
        }

        const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLOR)
            .setTitle(config.STUDIO_EMBED.title)
            .setDescription(config.STUDIO_EMBED.description);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("publish_script")
                .setLabel("انشر عملك")
                .setStyle(ButtonStyle.Danger)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
    },
};
