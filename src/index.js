require("dotenv").config();
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const config = require("./config");
const { connect } = require("./database");
const sendEmbedCmd = require("./commands/sendembed");
const session = require("./handlers/sessionHandler");
const ticket = require("./handlers/ticketHandler");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageAttachments,
    ],
    partials: [Partials.Channel, Partials.Message],
});

client.once("ready", async () => {
    await connect();
    console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (!message.guild) {
        await session.handleDMMessage(message, client);
        return;
    }

    if (message.content === "-sendembed") {
        await sendEmbedCmd.execute(message);
    }
});

client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isButton()) {
            const id = interaction.customId;

            if (id === "publish_script") {
                await session.startSession(interaction);
            } else if (id === "confirm_publish") {
                await session.handleConfirmPublish(interaction, client);
            } else if (id === "cancel_publish") {
                await session.handleCancelPublish(interaction);
            } else if (id === "pay_robux") {
                await session.handlePaymentSelection(interaction, config.PAYMENT_TYPES.ROBUX);
            } else if (id === "pay_credit") {
                await session.handlePaymentSelection(interaction, config.PAYMENT_TYPES.CREDIT);
            } else if (id === "pay_free") {
                await session.handlePaymentSelection(interaction, config.PAYMENT_TYPES.FREE);
            } else if (id.startsWith("download_")) {
                const publisherId = id.replace("download_", "");
                await ticket.handleDownload(interaction, publisherId);
            } else if (id.startsWith("buy_")) {
                const publisherId = id.replace("buy_", "");
                await ticket.handleBuy(interaction, publisherId, client);
            } else if (id.startsWith("close_ticket_")) {
                const channelId = id.replace("close_ticket_", "");
                await ticket.handleCloseTicket(interaction, channelId);
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "select_type") {
                await session.handleSelectType(interaction);
            }
        }
    } catch (err) {
        console.error(err);
    }
});

client.login(config.TOKEN);
