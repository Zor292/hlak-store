const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SectionBuilder,
    ThumbnailBuilder,
    MessageFlags,
} = require("discord.js");
const config = require("../config");
const { Script } = require("../database");

const V2 = { flags: MessageFlags.IsComponentsV2 };

async function handleVote(interaction, scriptId, type) {
    const script = await Script.findById(scriptId);
    if (!script) return interaction.reply({ content: "**لم يتم العثور على النظام.**", ephemeral: true });

    const userId = interaction.user.id;
    const likedBy = script.likedBy || [];
    const dislikedBy = script.dislikedBy || [];

    if (type === "like") {
        if (likedBy.includes(userId)) {
            return interaction.reply({ content: "**لقد سبق أن أعجبك هذا النظام.**", ephemeral: true });
        }
        script.likes = (script.likes || 0) + 1;
        script.likedBy = [...likedBy, userId];
        script.dislikedBy = dislikedBy.filter((id) => id !== userId);
        if (dislikedBy.includes(userId)) script.dislikes = Math.max(0, (script.dislikes || 0) - 1);
    } else {
        if (dislikedBy.includes(userId)) {
            return interaction.reply({ content: "**لقد سبق أن عدم إعجابك بهذا النظام.**", ephemeral: true });
        }
        script.dislikes = (script.dislikes || 0) + 1;
        script.dislikedBy = [...dislikedBy, userId];
        script.likedBy = likedBy.filter((id) => id !== userId);
        if (likedBy.includes(userId)) script.likes = Math.max(0, (script.likes || 0) - 1);
    }
    await script.save();

    const priceText = script.payment === config.PAYMENT_TYPES.FREE
        ? "مجاني"
        : `${script.price || "؟"} ${script.payment}`;

    const actionButton = script.payment === config.PAYMENT_TYPES.FREE
        ? new ButtonBuilder().setCustomId(`download_${scriptId}`).setLabel("تحميل النظام").setStyle(ButtonStyle.Danger)
        : new ButtonBuilder().setCustomId(`buy_${scriptId}`).setLabel("شراء").setStyle(ButtonStyle.Danger);

    const container = new ContainerBuilder()
        .setAccentColor(config.EMBED_COLOR)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`<@${script.publisherId}>`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(script.publisherAvatar))
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`اسم النظام\`\`\`
**${script.name || "غير محدد"}**`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`تفاصيل النظام\`\`\`
**${script.description || "—"}**`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`نوع النظام\`\`\`
**${script.types?.join(" / ") || "غير محدد"}**`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`السعر\`\`\`
**${priceText}**`));

    const videoExts = [".mp4", ".mov", ".webm", ".mkv", ".avi"];
    const isVideo = (url) => videoExts.some((ext) => url.toLowerCase().split("?")[0].endsWith(ext));
    const imageUrls = (script.mediaUrls || []).filter((u) => !isVideo(u));

    if (imageUrls.length > 0) {
        const gallery = new MediaGalleryBuilder();
        for (const url of imageUrls) {
            gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
        }
        container.addMediaGalleryComponents(gallery);
    }

    container
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                actionButton,
                new ButtonBuilder().setCustomId(`like_${scriptId}`).setLabel(`👍  ${script.likes}`).setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`dislike_${scriptId}`).setLabel(`👎  ${script.dislikes}`).setStyle(ButtonStyle.Secondary)
            )
        );

    await interaction.deferUpdate();
    await interaction.message.edit({ components: [container], ...V2 });
}

module.exports = { handleVote };
