const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
} = require("discord.js");
const config = require("../config");
const { Script, Ticket } = require("../database");

async function handleDownload(interaction, publisherId) {
    const script = await Script.findOne({ publisherId, payment: config.PAYMENT_TYPES.FREE });
    if (!script) {
        return interaction.reply({ content: "**لم يتم العثور على الملف.**", ephemeral: true });
    }

    try {
        const dm = await interaction.user.createDM();
        await dm.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(config.EMBED_COLOR)
                    .setDescription(`**${script.name}**`),
            ],
            files: [{ attachment: script.fileUrl, name: script.fileName || "system_file" }],
        });

        await interaction.reply({
            content: "**تم ارسال النظام اليك بالخاص.**",
            ephemeral: true,
        });
    } catch {
        await interaction.reply({
            content: "**لم اتمكن من ارسال الملف, تأكد ان خاصك مفتوح.**",
            ephemeral: true,
        });
    }
}

async function handleBuy(interaction, publisherId, client) {
    const script = await Script.findOne({ publisherId });
    if (!script) {
        return interaction.reply({ content: "**لم يتم العثور على النظام.**", ephemeral: true });
    }

    const guild = client.guilds.cache.get(config.GUILD_ID);
    const category = guild?.channels.cache.get(config.TICKET_CATEGORY_ID);
    if (!guild || !category) {
        return interaction.reply({ content: "**خطأ في الاعدادات.**", ephemeral: true });
    }

    const existing = await Ticket.findOne({
        buyerId: interaction.user.id,
        sellerId: publisherId,
        closed: false,
    });

    if (existing) {
        return interaction.reply({
            content: "**لديك تذكرة مفتوحة مع هذا البائع بالفعل.**",
            ephemeral: true,
        });
    }

    const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: interaction.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            },
            {
                id: publisherId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            },
        ],
    });

    const ticket = new Ticket({
        ticketId: channel.id,
        channelId: channel.id,
        buyerId: interaction.user.id,
        sellerId: publisherId,
        scriptId: script._id.toString(),
    });
    await ticket.save();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`close_ticket_${channel.id}`)
            .setLabel("غلق التذكرة")
            .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
        content: `<@${interaction.user.id}> <@${publisherId}>`,
        components: [row],
    });

    await interaction.reply({
        content: `**تم فتح التذكرة : ${channel}**`,
        ephemeral: true,
    });
}

async function handleCloseTicket(interaction, channelId) {
    const ticket = await Ticket.findOne({ channelId });
    if (!ticket) return interaction.reply({ content: "**لم يتم العثور على التذكرة.**", ephemeral: true });

    ticket.closed = true;
    await ticket.save();

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(config.EMBED_COLOR)
                .setDescription("**سيتم اغلاق التذكرة خلال 5 ثوان.**"),
        ],
    });

    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch {}
    }, 5000);
}

module.exports = { handleDownload, handleBuy, handleCloseTicket };
