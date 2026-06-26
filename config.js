require("dotenv").config();
const { Client, Partials } = require("discord.js");
const config = require("./config");
const { connect } = require("./database");
const sendEmbedCmd = require("./commands/sendembed");
const session = require("./handlers/sessionHandler");
const ticket = require("./handlers/ticketHandler");
const { handleVote } = require("./handlers/voteHandler");
const { handleApprove, handleRejectModal, handleRejectSubmit } = require("./handlers/reviewHandler");

const client = new Client({
    intents: [1 << 0, 1 << 9, 1 << 15, 1 << 12],
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
        if (interaction.isModalSubmit()) {
            const id = interaction.customId;
            if (id.startsWith("reject_reason_")) {
                const scriptId = id.replace("reject_reason_", "");
                await handleRejectSubmit(interaction, scriptId, client);
            }
            return;
        }

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
                const scriptId = id.replace("download_", "");
                await ticket.handleDownload(interaction, scriptId);
            } else if (id.startsWith("buy_")) {
                const scriptId = id.replace("buy_", "");
                await ticket.handleBuy(interaction, scriptId, client);
            } else if (id.startsWith("close_ticket_")) {
                const channelId = id.replace("close_ticket_", "");
                await ticket.handleCloseTicket(interaction, channelId);
            } else if (id.startsWith("like_")) {
                const scriptId = id.replace("like_", "");
                await handleVote(interaction, scriptId, "like");
            } else if (id.startsWith("dislike_")) {
                const scriptId = id.replace("dislike_", "");
                await handleVote(interaction, scriptId, "dislike");
            } else if (id.startsWith("approve_")) {
                const scriptId = id.replace("approve_", "");
                await handleApprove(interaction, scriptId, client);
            } else if (id.startsWith("reject_")) {
                const scriptId = id.replace("reject_", "");
                await handleRejectModal(interaction, scriptId);
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
