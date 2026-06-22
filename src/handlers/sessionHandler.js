const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require("discord.js");
const config = require("../config");
const { Session, Script } = require("../database");

async function startSession(interaction) {
    await interaction.reply({
        content: "**شوف الخاص بينك وبين البوت.**",
        ephemeral: true,
    });

    let session = await Session.findOne({ userId: interaction.user.id });
    if (!session) {
        session = new Session({ userId: interaction.user.id, step: 1, data: {} });
    } else {
        session.step = 1;
        session.data = {};
    }
    await session.save();

    const dm = await interaction.user.createDM();
    await dm.send({
        embeds: [
            new EmbedBuilder()
                .setColor(config.EMBED_COLOR)
                .setDescription("**اسم النظام ؟**"),
        ],
    });
}

async function handleDMMessage(message, client) {
    if (message.author.bot || message.guild) return;

    const session = await Session.findOne({ userId: message.author.id });
    if (!session) return;

    if (session.step === 1) {
        session.data.name = message.content;
        session.step = 2;
        await session.save();

        const typeMenu = new StringSelectMenuBuilder()
            .setCustomId("select_type")
            .setPlaceholder("اختر نوع النظام")
            .setMinValues(1)
            .setMaxValues(config.SYSTEM_TYPES.length)
            .addOptions(
                config.SYSTEM_TYPES.map((t) => ({ label: t, value: t }))
            );

        await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.EMBED_COLOR)
                    .setDescription("**نوع النظام ؟**"),
            ],
            components: [new ActionRowBuilder().addComponents(typeMenu)],
        });
        return;
    }

    if (session.step === 4) {
        session.data.price = message.content;
        session.step = 5;
        await session.save();
        await askForMedia(message.channel);
        return;
    }

    if (session.step === 5) {
        const attachments = [...message.attachments.values()];
        const urls = attachments.map((a) => a.url);
        if (urls.length === 0) {
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.EMBED_COLOR)
                        .setDescription("**الرجاء ارفاق صورة او فيديو واحد على الاقل.**"),
                ],
            });
            return;
        }
        session.data.mediaUrls = urls;

        if (session.data.payment === config.PAYMENT_TYPES.FREE) {
            session.step = 6;
            await session.save();
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.EMBED_COLOR)
                        .setDescription("**ارفق ملف النظام.**"),
                ],
            });
        } else {
            session.step = 7;
            await session.save();
            await sendConfirmation(message.channel, session.data);
        }
        return;
    }

    if (session.step === 6) {
        const file = message.attachments.first();
        if (!file) {
            await message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.EMBED_COLOR)
                        .setDescription("**الرجاء ارفاق ملف النظام.**"),
                ],
            });
            return;
        }
        session.data.fileUrl = file.url;
        session.data.fileName = file.name;
        session.step = 7;
        await session.save();
        await sendConfirmation(message.channel, session.data);
        return;
    }
}

async function handleSelectType(interaction) {
    const session = await Session.findOne({ userId: interaction.user.id });
    if (!session || session.step !== 2) return;

    session.data.types = interaction.values;
    session.step = 3;
    await session.save();

    const paymentRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("pay_robux")
            .setLabel(config.PAYMENT_TYPES.ROBUX)
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("pay_credit")
            .setLabel(config.PAYMENT_TYPES.CREDIT)
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("pay_free")
            .setLabel(config.PAYMENT_TYPES.FREE)
            .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({
        embeds: [
            new EmbedBuilder()
                .setColor(config.EMBED_COLOR)
                .setDescription("**طريقة الدفع ؟**"),
        ],
        components: [paymentRow],
    });
}

async function handlePaymentSelection(interaction, paymentType) {
    const session = await Session.findOne({ userId: interaction.user.id });
    if (!session || session.step !== 3) return;

    session.data.payment = paymentType;

    if (paymentType === config.PAYMENT_TYPES.FREE) {
        session.step = 5;
        await session.save();
        await interaction.update({ embeds: [], components: [] });
        await askForMedia(interaction.channel);
    } else {
        session.step = 4;
        await session.save();
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.EMBED_COLOR)
                    .setDescription("**السعر ؟**"),
            ],
            components: [],
        });
    }
}

async function askForMedia(channel) {
    await channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(config.EMBED_COLOR)
                .setDescription("**ارفق صور او فيديوهات للنظام.**"),
        ],
    });
}

async function sendConfirmation(channel, data) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("confirm_publish")
            .setLabel("نعم")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("cancel_publish")
            .setLabel("لا")
            .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(config.EMBED_COLOR)
                .setDescription("**هل انت متأكد من نشر السكربت ؟**"),
        ],
        components: [row],
    });
}

async function handleConfirmPublish(interaction, client) {
    const session = await Session.findOne({ userId: interaction.user.id });
    if (!session || session.step !== 7) return;

    await interaction.update({ embeds: [], components: [] });

    const data = session.data;
    const user = interaction.user;
    const guild = client.guilds.cache.get(config.GUILD_ID);
    const channel = guild?.channels.cache.get(config.SCRIPTS_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLOR)
        .setAuthor({
            name: `**${user.tag}**`,
            iconURL: user.displayAvatarURL({ size: 32 }),
        })
        .addFields(
            { name: "**اسم النظام**", value: `**${data.name}**`, inline: true },
            { name: "**نوع النظام**", value: `**${data.types.join(" / ")}**`, inline: true },
            { name: "**السعر**", value: `**${data.payment === config.PAYMENT_TYPES.FREE ? "مجاني" : `${data.price} - ${data.payment}`}**`, inline: true }
        );

    if (data.mediaUrls && data.mediaUrls.length > 0) {
        embed.setImage(data.mediaUrls[0]);
    }

    const components = [];

    if (data.payment === config.PAYMENT_TYPES.FREE) {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`download_${user.id}`)
                    .setLabel("تحميل النظام")
                    .setStyle(ButtonStyle.Danger)
            )
        );
    } else {
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`buy_${user.id}`)
                    .setLabel("شراء")
                    .setStyle(ButtonStyle.Danger)
            )
        );
    }

    const msg = await channel.send({ embeds: [embed], components });

    const script = new Script({
        publisherId: user.id,
        publisherTag: user.tag,
        publisherAvatar: user.displayAvatarURL(),
        name: data.name,
        types: data.types,
        payment: data.payment,
        price: data.price || null,
        mediaUrls: data.mediaUrls || [],
        fileUrl: data.fileUrl || null,
        fileName: data.fileName || null,
        messageId: msg.id,
        channelId: channel.id,
    });
    await script.save();

    await session.deleteOne();

    await interaction.channel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(config.EMBED_COLOR)
                .setDescription("**تم نشر النظام بنجاح.**"),
        ],
    });
}

async function handleCancelPublish(interaction) {
    await Session.deleteOne({ userId: interaction.user.id });
    await interaction.update({
        embeds: [
            new EmbedBuilder()
                .setColor(config.EMBED_COLOR)
                .setDescription("**تم الغاء النشر.**"),
        ],
        components: [],
    });
}

module.exports = {
    startSession,
    handleDMMessage,
    handleSelectType,
    handlePaymentSelection,
    handleConfirmPublish,
    handleCancelPublish,
};
