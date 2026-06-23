const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} = require("discord.js");
const config = require("../config");
const { Script, Ticket } = require("../database");

const V2 = { flags: MessageFlags.IsComponentsV2 };

async function handleDownload(interaction, scriptId) {
    const script = await Script.findById(scriptId);
    if (!script) {
        return interaction.reply({ content: "**لم يتم العثور على الملف.**", ephemeral: true });
    }

    try {
        const dm = await interaction.user.createDM();
        await dm.send({
            content: `**${script.name}**`,
            files: [{ attachment: script.fileUrl, name: script.fileName || "system_file" }],
        });
        await interaction.reply({ content: "**تم ارسال النظام اليك بالخاص.**", ephemeral: true });
    } catch {
        await interaction.reply({ content: "**لم اتمكن من ارسال الملف, تأكد ان خاصك مفتوح.**", ephemeral: true });
    }
}

async function handleBuy(interaction, scriptId, client) {
    const script = await Script.findById(scriptId);
    if (!script) {
        return interaction.reply({ content: "**لم يتم العثور على النظام.**", ephemeral: true });
    }

    const guild = client.guilds.cache.get(config.GUILD_ID);
    const category = guild?.channels.cache.get(config.TICKET_CATEGORY_ID);
    if (!guild || !category) {
        return interaction.reply({ content: "**خطأ في الاعدادات.**", ephemeral: true });
    }

    const existing = await Ticket.findOne({ buyerId: interaction.user.id, scriptId, closed: false });
    if (existing) {
        return interaction.reply({ content: "**لديك تذكرة مفتوحة لهذا النظام بالفعل.**", ephemeral: true });
    }

    const channel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: script.publisherId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
    });

    const ticket = new Ticket({
        ticketId: channel.id,
        channelId: channel.id,
        buyerId: interaction.user.id,
        sellerId: script.publisherId,
        scriptId: scriptId,
    });
    await ticket.save();

    const container = new ContainerBuilder()
        .setAccentColor(config.EMBED_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`<@${interaction.user.id}> <@${script.publisherId}>`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`close_ticket_${channel.id}`)
                    .setLabel("غلق التذكرة")
                    .setStyle(ButtonStyle.Danger)
            )
        );

    await channel.send({ components: [container], ...V2 });
    await interaction.reply({ content: `**تم فتح التذكرة : ${channel}**`, ephemeral: true });
}

async function handleCloseTicket(interaction, channelId) {
    const ticket = await Ticket.findOne({ channelId });
    if (!ticket) return interaction.reply({ content: "**لم يتم العثور على التذكرة.**", ephemeral: true });

    ticket.closed = true;
    await ticket.save();

    const container = new ContainerBuilder()
        .setAccentColor(config.EMBED_COLOR)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("**سيتم اغلاق التذكرة خلال 5 ثوان.**"));

    await interaction.reply({ components: [container], ...V2 });

    setTimeout(async () => {
        try { await interaction.channel.delete(); } catch {}
    }, 5000);
}

module.exports = { handleDownload, handleBuy, handleCloseTicket };
