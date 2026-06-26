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
    StringSelectMenuBuilder,
    MessageFlags,
    EmbedBuilder,
} = require("discord.js");
const config = require("../config");
const { Session, Script } = require("../database");

const V2 = { flags: MessageFlags.IsComponentsV2 };

function simpleEmbed(text) {
    return { embeds: [new EmbedBuilder().setColor(config.EMBED_COLOR).setDescription(text)] };
}

async function startSession(interaction) {
    await interaction.reply({ content: "**شوف الخاص بينك وبين البوت.**", ephemeral: true });

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
    await dm.send(simpleEmbed("**اسم النظام ؟**"));
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
            ...simpleEmbed("**نوع النظام ؟**"),
            components: [new ActionRowBuilder().addComponents(typeMenu)],
        });
        return;
    }

    if (session.step === 25) {
        session.data.description = message.content;
        session.step = 3;
        session.markModified("data");
        await session.save();

        const paymentRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("pay_robux").setLabel(config.PAYMENT_TYPES.ROBUX).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("pay_credit").setLabel(config.PAYMENT_TYPES.CREDIT).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("pay_free").setLabel(config.PAYMENT_TYPES.FREE).setStyle(ButtonStyle.Danger)
        );

        await message.channel.send({
            ...simpleEmbed("**طريقة الدفع ؟**"),
            components: [paymentRow],
        });
        return;
    }

    if (session.step === 4) {
        session.data.price = message.content;
        session.step = 5;
        session.markModified("data");
        await session.save();
        await message.channel.send(simpleEmbed("**ارفق صور او فيديوهات للنظام.**"));
        return;
    }

    if (session.step === 5) {
        const attachments = [...message.attachments.values()];
        const urls = attachments.map((a) => a.url);
        if (urls.length === 0) {
            await message.channel.send(simpleEmbed("**الرجاء ارفاق صورة او فيديو واحد على الاقل.**"));
            return;
        }
        session.data.mediaUrls = urls;
        session.markModified("data");

        if (session.data.payment === config.PAYMENT_TYPES.FREE) {
            session.step = 6;
            await session.save();
            await message.channel.send(simpleEmbed("**ارفق ملف النظام.**"));
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
            await message.channel.send(simpleEmbed("**الرجاء ارفاق ملف النظام.**"));
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
    session.step = 25;
    session.markModified("data");
    await session.save();

    await interaction.reply({ ...simpleEmbed("**اذكر تفاصيل النظام.**") });
}

async function handlePaymentSelection(interaction, paymentType) {
    const session = await Session.findOne({ userId: interaction.user.id });
    if (!session || session.step !== 3) return;

    session.data.payment = paymentType;
    session.markModified("data");

    if (paymentType === config.PAYMENT_TYPES.FREE) {
        session.step = 5;
        await session.save();
        await interaction.reply({ ...simpleEmbed("**ارفق صور او فيديوهات للنظام.**") });
    } else {
        session.step = 4;
        await session.save();
        await interaction.reply({ ...simpleEmbed("**السعر ؟**") });
    }
}

async function sendConfirmation(channel) {
    const container = new ContainerBuilder()
        .setAccentColor(config.EMBED_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("**هل انت متأكد من نشر السكربت ؟**"))
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("confirm_publish").setLabel("نعم").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("cancel_publish").setLabel("لا").setStyle(ButtonStyle.Secondary)
            )
        );

    await channel.send({ components: [container], ...V2 });
}

async function handleConfirmPublish(interaction, client) {
    const session = await Session.findOne({ userId: interaction.user.id });
    if (!session || session.step !== 7) return;

    await interaction.deferUpdate();
    await interaction.message.edit({
        components: [
            new ContainerBuilder()
                .setAccentColor(config.EMBED_COLOR)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("**جاري النشر...**")),
        ],
        flags: MessageFlags.IsComponentsV2,
    });

    const data = session.data;
    const user = interaction.user;
    const types = Array.isArray(data.types) ? data.types : [];
    const mediaUrls = Array.isArray(data.mediaUrls) ? data.mediaUrls : [];

    const guild = client.guilds.cache.get(config.GUILD_ID);
    const channel = guild?.channels.cache.get(config.SCRIPTS_CHANNEL_ID);
    if (!channel) {
        await interaction.channel.send(simpleEmbed("**خطأ: لم يتم العثور على روم النشر.**"));
        return;
    }

    const priceText = data.payment === config.PAYMENT_TYPES.FREE
        ? "مجاني"
        : `${data.price || "؟"} ${data.payment}`;

    const videoExts = [".mp4", ".mov", ".webm", ".mkv", ".avi"];
    const isVideo = (url) => videoExts.some((ext) => url.toLowerCase().split("?")[0].endsWith(ext));
    const imageUrls = mediaUrls.filter((u) => !isVideo(u));
    const videoUrls = mediaUrls.filter((u) => isVideo(u));

    const script = new Script({
        publisherId: user.id,
        publisherTag: user.tag,
        publisherAvatar: user.displayAvatarURL(),
        name: data.name || "",
        description: data.description || "",
        types: types,
        payment: data.payment,
        price: data.price || null,
        mediaUrls: mediaUrls,
        fileUrl: data.fileUrl || null,
        fileName: data.fileName || null,
        channelId: channel.id,
        likes: 0,
        dislikes: 0,
    });
    await script.save();

    const scriptId = script._id.toString();

    await script.save();
    await session.deleteOne();

    const { sendForReview } = require("./reviewHandler");
    await sendForReview(client, script);

    await interaction.channel.send(simpleEmbed("**تم ارسال النظام للمراجعة, سيتم إشعارك عند القبول أو الرفض.**"));
}

async function handleCancelPublish(interaction) {
    await Session.deleteOne({ userId: interaction.user.id });
    await interaction.deferUpdate();
    await interaction.message.edit({
        components: [
            new ContainerBuilder()
                .setAccentColor(config.EMBED_COLOR)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("**تم الغاء النشر.**")),
        ],
        flags: MessageFlags.IsComponentsV2,
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
