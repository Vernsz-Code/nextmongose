"use server";
import { connectDB } from "@/lib/mongodb";
import Voucher from "@/models/Voucher";

// Function to format date to WIB timezone
const formatDateToWIB = (date) => {
  const indonesiaTime = new Date(date.getTime() + 7 * 60 * 60 * 1000); // Add 7 hours
  const formattedDate = indonesiaTime.toISOString().split("T")[0];
  const formattedTime = indonesiaTime.toISOString().split("T")[1].split(".")[0];
  return `${formattedDate} ${formattedTime}`;
};

// Function to process voucher transactions with sorting and filtering by year and month
export const getVouchersTransaksiH = async (
  sign,
  sortOrder = "desc",
  year = null,
  month = null
) => {
  try {
    await connectDB();
    console.log(`[INFO] Fetching vouchers for sign: ${sign}`);

    // Fetch vouchers with matching sign
    const vouchers = await Voucher.find({ sign });

    if (vouchers.length === 0) {
      console.log(`[INFO] No vouchers found for sign: ${sign}`);
    }

    let totalGrossProfit = 0; // Initialize total gross profit

    const processedVouchers = vouchers.map((voucher) => {
      const historyTransaksi = voucher.historyTransaksi || [];

      if (historyTransaksi.length === 0) {
        console.log(`[INFO] Voucher ${voucher._id} has no transactions.`);
      }

      // Filter transactions by year and month
      const filteredHistory = historyTransaksi.filter((transaction) => {
        const transactionDate = transaction.date
          ? new Date(transaction.date)
          : null;

        if (!transactionDate || isNaN(transactionDate.getTime())) {
          console.warn(
            `[WARNING] Invalid or missing date for transaction in voucher ${voucher._id}.`
          );
          return false;
        }

        // Apply year filter
        if (year && transactionDate.getFullYear() !== +year) {
          return false;
        }

        // Apply month filter
        if (month && transactionDate.getMonth() + 1 !== +month) {
          return false;
        }

        return true;
      });

      // Sort transactions based on date
      const sortedHistory = filteredHistory.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });

      // Log transactions after filtering and sorting
      console.log(
        `[INFO] Voucher ${voucher._id} transactions after filtering and sorting:`,
        JSON.stringify(sortedHistory, null, 2)
      );

      // Calculate gross profit
      const grossProfit = sortedHistory.reduce((acc, transaction) => {
        const price = transaction.details?.price || 0;
        return acc + price;
      }, 0);

      totalGrossProfit += grossProfit;

      return {
        ...voucher.toObject(),
        historyTransaksi: sortedHistory.map((transaction) => ({
          ...transaction,
          formattedDate: transaction.date
            ? formatDateToWIB(new Date(transaction.date))
            : null,
          _id: transaction._id.toString(), // Convert ObjectId to string
        })),
        grossProfit,
      };
    });

    console.log("Processed Vouchers:", processedVouchers);
    console.log("Total Gross Profit:", totalGrossProfit);

    return {
      vouchers: processedVouchers,
      totalGrossProfit,
    };
  } catch (error) {
    console.error("[ERROR] Error fetching vouchers:", error);
    return { vouchers: [], totalGrossProfit: 0 };
  }
};
