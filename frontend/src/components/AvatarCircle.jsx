import { useEffect, useMemo, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { getProfileInitials, resolveProfileImageUrl } from "../utils/profileImage";

const AvatarCircle = ({
    profile,
    sizeClassName = "w-10 h-10",
    textClassName = "text-sm",
    className = "",
    fallbackClassName = "bg-primary-100 text-primary-700 border border-primary-200",
    alt = "Profile image",
}) => {
    const src = useMemo(() => resolveProfileImageUrl(profile), [profile]);
    const initials = useMemo(() => getProfileInitials(profile), [profile]);
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setImageFailed(false);
    }, [src]);

    const wrapperClassName = `${sizeClassName} ${className}`.trim();

    if (src && !imageFailed) {
        return (
            <img
                src={src}
                alt={alt}
                className={`${wrapperClassName} rounded-full object-cover border border-gray-200`}
                onError={() => setImageFailed(true)}
            />
        );
    }

    return (
        <div
            className={`${wrapperClassName} rounded-full flex items-center justify-center font-semibold ${textClassName} ${fallbackClassName}`.trim()}
            aria-label={alt}
            title={alt}
        >
            {initials ? initials : <UserCircle2 className="w-5 h-5" />}
        </div>
    );
};

export default AvatarCircle;
