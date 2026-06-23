const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require("discord.js");
const config = require("../config");
const { Session, Script } = require("../database");

async function dmUpdate(interaction, options) {
    await interaction.deferUpdate();
    await interaction.message.edit(options);
}

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
    session.markModified("data");
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
        session.markModified("data");
        await session.save();

        const typeMenu = new StringSelectMenuBuilder()
            .setCustomId("select_type")
            .setPlaceholder("اختر نوع النظام")
            .setMinValues(1)
            .setMaxValues(config.SYSTEM_TYPES.length)
            .addOptions(config.SYSTEM_TYPES.map((t) => ({ label: t, value: t })));

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
        session.markModified("data");
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
        session.markModified("data");

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
            await sendConfirmation(message.channel);
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
        session.markModified("data");
        await session.save();
        await sendConfirmation(message.channel);
        return;
    }
}

async function handleSelectType(interaction) {
    const session = await Session.findOne({ userId: interaction.user.id });
    if (!session || session.step !== 2) return;

    session.data.types = interaction.values;
    session.step = 3;
    session.markModified("data");
    await session.save();

    const paymentRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("pay_robux").setLabel(config.PAYMENT_TYPES.ROBUX).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("pay_credit").setLabel(config.PAYMENT_TYPES.CREDIT).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("pay_free").setLabel(config.PAYMENT_TYPES.FREE).setStyle(ButtonStyle.Danger)
    );

    await dmUpdate(interaction, {
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
    session.markModified("data");

    if (paymentType === config.PAYMENT_TYPES.FREE) {
        session.step = 5;
        await session.save();
        await dmUpdate(interaction, {
            embeds: [
                new EmbedBuilder()
                    .setColor(config.EMBED_COLOR)
                    .setDescription("**طريقة الدفع : مجانا**"),
            ],
            components: [],
        });
        await askForMedia(interaction.channel);
    } else {
        session.step = 4;
        await session.save();
        await dmUpdate(interaction, {
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

async function sendConfirmation(channel) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("confirm_publish").setLabel("نعم").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("cancel_publish").setLabel("لا").setStyle(ButtonStyle.Secondary)
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

    await dmUpdate(interaction, {
        embeds: [
            new EmbedBuilder()
                .setColor(config.EMBED_COLOR)
                .setDescription("**جاري النشر...**"),
        ],
        components: [],
    });

    const data = session.data;
    const user = interaction.user;
    const types = Array.isArray(data.types) ? data.types : [];
    const mediaUrls = Array.isArray(data.mediaUrls) ? data.mediaUrls : [];

    const guild = client.guilds.cache.get(config.GUILD_ID);
    const channel = guild?.channels.cache.get(config.SCRIPTS_CHANNEL_ID);
    if (!channel) {
        await interaction.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.EMBED_COLOR)
                    .setDescription("**خطأ: لم يتم العثور على روم النشر.**"),
            ],
        });
        return;
    }

    const priceText = data.payment === config.PAYMENT_TYPES.FREE
        ? "مجاني"
        : `${data.price || "؟"} ${data.payment}`;

    const embed = new EmbedBuilder()
        .setColor(config.EMBED_COLOR)
        .setAuthor({
            name: user.tag,
            iconURL: user.displayAvatarURL({ size: 32 }),
        })
        .setDescription(
            `**اسم النظام**\n${data.name || "غير محدد"}\n\n` +
            `**نوع النظام**\n${types.length > 0 ? types.join(" / ") : "غير محدد"}\n\n` +
            `**السعر**\n${priceText}`
        );

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

    await channel.send({ files: mediaUrls });

    const msg = await channel.send({ embeds: [embed], components });

    await channel.send({ content: "https://cdn.discordapp.com/attachments/1505638957835354257/1513850496648085747/1774701434189.png?ex=6a3b06e4&is=6a39b564&hm=453c20bfd392ec2b4c53e655b62b50cd94bec0f29ecec09cdcee4168dafc56fc&" });

    const script = new Script({
        publisherId: user.id,
        publisherTag: user.tag,
        publisherAvatar: user.displayAvatarURL(),
        name: data.name || "",
        types: types,
        payment: data.payment,
        price: data.price || null,
        mediaUrls: mediaUrls,
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
    await dmUpdate(interaction, {
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
