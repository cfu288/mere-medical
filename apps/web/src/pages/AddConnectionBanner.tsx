export function AddConnectionBanner({
  text = "Add New Record",
}: {
  image?: string;
  text?: string;
  subtext?: string;
}) {
  return (
    <>
      <div className="flex items-stretch bg-primary px-4 py-6 pt-12">
        <div className="flex flex-row items-stretch">
          <div className="flex-column align-middle">
            <p className="text-xl font-black text-white uppercase">{text}</p>
          </div>
        </div>
      </div>
    </>
  );
}
