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
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    EmbedBuilder,
} = require("discord.js");
const config = require("../config");
const { Script } = require("../database");

const V2 = { flags: MessageFlags.IsComponentsV2 };

function simpleEmbed(text) {
    return { embeds: [new EmbedBuilder().setColor(config.EMBED_COLOR).setDescription(text)] };
}

async function sendForReview(client, script) {
    const guild = client.guilds.cache.get(config.GUILD_ID);
    const reviewChannel = guild?.channels.cache.get(config.REVIEW_CHANNEL_ID);
    if (!reviewChannel) return;

    const scriptId = script._id.toString();

    const priceText = script.payment === config.PAYMENT_TYPES.FREE
        ? "مجاني"
        : `${script.price || "؟"} ${script.payment}`;

    const videoExts = [".mp4", ".mov", ".webm", ".mkv", ".avi"];
    const isVideo = (url) => videoExts.some((ext) => url.toLowerCase().split("?")[0].endsWith(ext));
    const imageUrls = (script.mediaUrls || []).filter((u) => !isVideo(u));
    const videoUrls = (script.mediaUrls || []).filter((u) => isVideo(u));

    const container = new ContainerBuilder()
        .setAccentColor(config.EMBED_COLOR)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`<@${script.publisherId}>`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(script.publisherAvatar))
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`اسم النظام\`\`\`\n**${script.name || "غير محدد"}**`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`تفاصيل النظام\`\`\`\n**${script.description || "—"}**`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`نوع النظام\`\`\`\n**${script.types?.join(" / ") || "غير محدد"}**`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`السعر\`\`\`\n**${priceText}**`));

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
                new ButtonBuilder().setCustomId(`approve_${scriptId}`).setLabel("قبول").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`reject_${scriptId}`).setLabel("رفض").setStyle(ButtonStyle.Danger)
            )
        );

    for (const vid of videoUrls) {
        await reviewChannel.send({ content: vid });
    }

    const msg = await reviewChannel.send({ components: [container], ...V2 });

    script.reviewMessageId = msg.id;
    await script.save();
}

async function handleApprove(interaction, scriptId, client) {
    const script = await Script.findById(scriptId);
    if (!script) return interaction.reply({ content: "**لم يتم العثور على النظام.**", ephemeral: true });

    script.status = "approved";
    await script.save();

    const guild = client.guilds.cache.get(config.GUILD_ID);
    const publishChannel = guild?.channels.cache.get(config.SCRIPTS_CHANNEL_ID);
    if (!publishChannel) return;

    const priceText = script.payment === config.PAYMENT_TYPES.FREE
        ? "مجاني"
        : `${script.price || "؟"} ${script.payment}`;

    const videoExts = [".mp4", ".mov", ".webm", ".mkv", ".avi"];
    const isVideo = (url) => videoExts.some((ext) => url.toLowerCase().split("?")[0].endsWith(ext));
    const imageUrls = (script.mediaUrls || []).filter((u) => !isVideo(u));
    const videoUrls = (script.mediaUrls || []).filter((u) => isVideo(u));

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
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`اسم النظام\`\`\`\n**${script.name || "غير محدد"}**`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`تفاصيل النظام\`\`\`\n**${script.description || "—"}**`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`نوع النظام\`\`\`\n**${script.types?.join(" / ") || "غير محدد"}**`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`السعر\`\`\`\n**${priceText}**`));

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
                new ButtonBuilder().setCustomId(`like_${scriptId}`).setLabel("👍  0").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`dislike_${scriptId}`).setLabel("👎  0").setStyle(ButtonStyle.Secondary)
            )
        );

    for (const vid of videoUrls) {
        await publishChannel.send({ content: vid });
    }

    const msg = await publishChannel.send({ components: [container], ...V2 });

    await publishChannel.send({
        content: "https://cdn.discordapp.com/attachments/1505638957835354257/1513850496648085747/1774701434189.png?ex=6a3b06e4&is=6a39b564&hm=453c20bfd392ec2b4c53e655b62b50cd94bec0f29ecec09cdcee4168dafc56fc&",
    });

    script.messageId = msg.id;
    await script.save();

    await interaction.deferUpdate();
    await interaction.message.edit({
        components: [
            new ContainerBuilder()
                .setAccentColor(0x00AA00)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**تم القبول بواسطة <@${interaction.user.id}>**`)),
        ],
        ...V2,
    });

    try {
        const publisher = await client.users.fetch(script.publisherId);
        await publisher.send(simpleEmbed(`**تم قبول نظامك \`${script.name}\` ونشره في ستوديو هلاك.**`));
    } catch {}
}

async function handleRejectModal(interaction, scriptId) {
    const modal = new ModalBuilder()
        .setCustomId(`reject_reason_${scriptId}`)
        .setTitle("سبب الرفض");

    const reasonInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("السبب")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder("اكتب سبب الرفض هنا...");

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
}

async function handleRejectSubmit(interaction, scriptId, client) {
    const reason = interaction.fields.getTextInputValue("reason");
    const script = await Script.findById(scriptId);
    if (!script) return interaction.reply({ content: "**لم يتم العثور على النظام.**", ephemeral: true });

    script.status = "rejected";
    await script.save();

    await interaction.deferUpdate();
    await interaction.message.edit({
        components: [
            new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**تم الرفض بواسطة <@${interaction.user.id}>**\n\n**السبب:** ${reason}`
                )),
        ],
        ...V2,
    });

    try {
        const publisher = await client.users.fetch(script.publisherId);
        await publisher.send(simpleEmbed(
            `**تم رفض نظامك \`${script.name}\`**\n\n**السبب:**\n${reason}`
        ));
    } catch {}
}

module.exports = { sendForReview, handleApprove, handleRejectModal, handleRejectSubmit };
